from marshmallow_sqlalchemy import ModelSchema
from model import DT

class DTSchema(ModelSchema):
    class Meta:
        model = DT
        strict = True
        # exclude = (['uid'])

dt_schema = DTSchema(many=True)