"""
Authentication, bcrypt password hashing, and local JWT token verification utilities
"""
import os
from datetime import datetime, timedelta
from fastapi import Header, HTTPException, Depends
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import User

# --- Cryptography / Password Hashing ---
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        plain_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

# --- JWT Access Token Creation ---
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# --- Get Current User Dependency ---
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    """
    Decodes the local JWT access token from the Authorization header,
    retrieves and returns the User object from PostgreSQL.
    Bypasses token verification ONLY in automated testing mode (TESTING=True).
    """
    # Check if we are running in testing environment (automated integration tests)
    is_testing = os.getenv("TESTING") == "True" or os.getenv("TESTING") == "true"
    if is_testing:
        user = db.query(User).filter(User.email == "test.user@tadaai.app").first()
        if not user:
            user = User(id="test-user-id", email="test.user@tadaai.app", full_name="Test User", avatar_url=None)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ")[1]

    try:
        # Decode and verify custom JWT access token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token payload missing user ID claim")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User associated with token not found")

        return user

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired access token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")
