import re


PASSWORD_MIN_LENGTH = 12


def validate_password_strength(value: str) -> str:
    """
    Validate the system password policy.

    Requirements:
    - At least 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    - No whitespace
    """

    if not isinstance(value, str):
        raise ValueError("Password must be a string")

    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(
            "Password must contain at least 12 characters."
        )

    if any(char.isspace() for char in value):
        raise ValueError(
            "Password must not contain whitespace."
        )

    if not re.search(r"[A-Z]", value):
        raise ValueError(
            "Password must contain at least one uppercase letter."
        )

    if not re.search(r"[a-z]", value):
        raise ValueError(
            "Password must contain at least one lowercase letter."
        )

    if not re.search(r"[0-9]", value):
        raise ValueError(
            "Password must contain at least one number."
        )

    if not re.search(r"[^A-Za-z0-9\s]", value):
        raise ValueError(
            "Password must contain at least one special character."
        )

    return value
