from sqlalchemy import create_engine, func, literal, or_, union
from sqlalchemy.orm import sessionmaker

from model import DT
from schema import dt_schema

import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    logger.info(event)

    logger.info(event)
    # logger.info(context)

    try:
        myeng = '{}+psycopg2://{}:{}@{}:{}/{}'.format(
            os.getenv("DRIVER"),
            os.getenv("USER"),
            os.getenv("PASSWORD"),
            os.getenv("HOSTNAME"),
            os.getenv("PORT"),
            os.getenv("DATABASE")
        )

        engine = create_engine(myeng)
        Session = sessionmaker(bind=engine)
        Session.configure(bind=engine)
        session = Session()
        SetPath = "SET search_path TO %s" %os.environ["SCHEMA"]
        session.execute(SetPath)

        event['body-json']['myColumnFilter'] = 'mycolumnInput'

        myquery = session.query(DT)
        output = dt_schema.dumps(myquery).limit(100)

        return json.dumps(output)
    
    except Exception as e:
        logger.error(e)
        raise Exception('400')