"""
Database initialization script to create all schema tables and seed demo data using native bcrypt
"""
import sys
import bcrypt
from app.database import engine, Base, SessionLocal
from app.models.models import User

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def init_database():
    print("Initializing database tables for TADA AI...")
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        print("Database schema tables created successfully!")

        # Add column if not exists (for backward compatibility if tables already exist)
        with engine.connect() as conn:
            from sqlalchemy import text
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR"))
                conn.commit()
                print("Hashed password column verification complete.")
            except Exception as e:
                print(f"Note: Column check query skipped or failed: {e}")

        # Seed demo user
        db = SessionLocal()
        try:
            demo_email = "demo@tadaai.app"
            demo_user = db.query(User).filter(User.email == demo_email).first()
            if not demo_user:
                print("Seeding demo user account...")
                hashed_password = hash_password("demo123")
                demo_user = User(
                    id="demo-user-id",
                    email=demo_email,
                    full_name="Demo User",
                    avatar_url=None,
                    hashed_password=hashed_password
                )
                db.add(demo_user)
                db.commit()
                print("Demo user account seeded successfully!")
            else:
                # Update password to ensure it matches demo123
                demo_user.hashed_password = hash_password("demo123")
                demo_user.full_name = "Demo User"
                db.commit()
                print("Demo user account verified/updated.")
        finally:
            db.close()

    except Exception as e:
        print(f"Error initializing database: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    init_database()
