"""
Authentication routes for TADA AI - handles register, login, and profile fetching.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.models import User
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()

# --- Pydantic Schemas ---
class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    avatar_url: str | None
    created_at: str

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# --- Routes ---

@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    # Hash the password and create user
    hashed = hash_password(data.password)
    user = User(
        email=data.email.lower().strip(),
        full_name=data.full_name.strip(),
        hashed_password=hashed,
        avatar_url=None
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate access token
    access_token = create_access_token(data={"sub": user.id})

    # Prepare response user
    user_res = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat()
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_res
    )

@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password"
        )

    # Generate access token
    access_token = create_access_token(data={"sub": user.id})

    # Prepare response user
    user_res = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat()
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_res
    )

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat()
    )


class GoogleLoginRequest(BaseModel):
    credential: str


@router.get("/google/config")
async def get_google_config():
    from app.config import settings
    return {"client_id": settings.GOOGLE_CLIENT_ID}


@router.post("/google/login", response_model=TokenResponse)
async def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    from app.config import settings
    import httpx
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth is not configured on the backend (GOOGLE_CLIENT_ID is blank)"
        )
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={data.credential}"
        )
        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential"
            )
        info = res.json()
        
        if info.get("aud") != settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google Client ID mismatch"
            )
            
        email = info.get("email").lower().strip()
        full_name = info.get("name", "").strip()
        avatar_url = info.get("picture")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=None,
                avatar_url=avatar_url
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            db.commit()
            db.refresh(user)

        access_token = create_access_token(data={"sub": user.id})
        
        user_res = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat()
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_res
        )


class GitHubLoginRequest(BaseModel):
    code: str


@router.get("/github/config")
async def get_github_config():
    from app.config import settings
    return {"client_id": settings.GITHUB_CLIENT_ID}


@router.post("/github/login", response_model=TokenResponse)
async def github_login(data: GitHubLoginRequest, db: Session = Depends(get_db)):
    from app.config import settings
    import httpx
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth is not configured on the backend (GITHUB_CLIENT_ID/SECRET is blank)"
        )
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": data.code,
                "redirect_uri": "http://localhost:4001/auth/callback"
            },
            headers={"Accept": "application/json"}
        )
        if token_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange GitHub authorization code"
            )
            
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=token_data.get("error_description") or "Invalid code or client credentials"
            )
            
        headers = {
            "Authorization": f"token {access_token}",
            "User-Agent": "TADA-AI-App"
        }
        profile_res = await client.get("https://api.github.com/user", headers=headers)
        if profile_res.status_code != 200:
            import logging
            logging.error(
                f"GitHub API /user fetch failed. Status: {profile_res.status_code}. "
                f"Response: {profile_res.text}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch GitHub profile: status {profile_res.status_code}"
            )
        profile_info = profile_res.json()
        
        email = profile_info.get("email")
        if not email:
            emails_res = await client.get("https://api.github.com/user/emails", headers=headers)
            if emails_res.status_code == 200:
                emails_info = emails_res.json()
                for em in emails_info:
                    if em.get("primary"):
                        email = em.get("email")
                        break
                if not email and emails_info:
                    email = emails_info[0].get("email")
            else:
                import logging
                logging.error(
                    f"GitHub API /user/emails fetch failed. Status: {emails_res.status_code}. "
                    f"Response: {emails_res.text}"
                )
                    
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub account must have an email address"
            )
            
        email = email.lower().strip()
        full_name = (profile_info.get("name") or profile_info.get("login") or "").strip()
        avatar_url = profile_info.get("avatar_url")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=None,
                avatar_url=avatar_url
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            updated = False
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
                updated = True
            if full_name and not user.full_name:
                user.full_name = full_name
                updated = True
            if updated:
                db.commit()
                db.refresh(user)
                
        app_access_token = create_access_token(data={"sub": user.id})
        
        user_res = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat()
        )
        
        return TokenResponse(
            access_token=app_access_token,
            token_type="bearer",
            user=user_res
        )
