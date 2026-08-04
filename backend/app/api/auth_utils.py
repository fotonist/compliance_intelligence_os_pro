from fastapi import HTTPException, status
from jose import jwt, JWTError

SECRET_KEY = "secret_key_here"
ALGORITHM = "HS256"


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
