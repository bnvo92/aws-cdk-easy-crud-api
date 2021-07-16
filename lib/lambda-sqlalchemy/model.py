from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, Date

Base = declarative_base()
# https://docs.sqlalchemy.org/en/13/orm/extensions/declarative/api.html

class DT(Base):
    __tablename__ = 'myDemoTable'
    userId = Column(String, primary_key=True)
    customerId = Column(String)
