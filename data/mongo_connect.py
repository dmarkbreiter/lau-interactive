from mongoengine import connect
import os
from dotenv import load_dotenv
import sys

DB_URI='mongodb+srv://drm1217:mapsarecool@lau.sybdh.mongodb.net/lau?retryWrites=true&w=majority'

def global_init():
    #load_dotenv()
    #DB_URI = os.getenv('DB_URI')
    print('This is standard output', file=sys.stdout)
    connect(alias='laumap', host=DB_URI)
    #mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')