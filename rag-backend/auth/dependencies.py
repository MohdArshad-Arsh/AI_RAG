from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from auth.jwt_handler import verify_token

security = HTTPBearer()

def get_current_user(credentials=Depends(security)):
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

def require_role(role: str):
    def checker(user=Depends(get_current_user)):
        if user.get("role") != role:
            raise HTTPException(status_code=403, detail="Access forbidden")
        return user
    return checker