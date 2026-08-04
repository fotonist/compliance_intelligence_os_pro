from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from app.core.config import settings   # SECRET_KEY, ALGORITHM buradan gelir

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def check_role(allowed_roles: list):
    """
    RBAC kontrolü:
    - Token decode edilir
    - 'role' claim okumur
    - allowed_roles içinde değilse 403 döner
    """

    def role_checker(token: str = Depends(oauth2_scheme)):
        try:
            # Token çözümü
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_role = payload.get("role")

            if user_role is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Role not found in token"
                )

            if user_role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {allowed_roles}"
                )

            return True

        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

    return role_checker
