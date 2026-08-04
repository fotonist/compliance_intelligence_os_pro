from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)

    # ❗ ÖNEMLİ
    # Bu model bir pivot/köprü modeldir. User veya Role ile relationship kurulmaz.
    # Çünkü User.roles ve Role.users secondary üzerinden ilişkilendiriliyor.
    #
    # Eğer burada relationship tanımlarsak SQLAlchemy ilişki çakışması uyarısı verir.
    #
    # Bu nedenle bu modelde ilişki tanımı OLMAMALIDIR.
