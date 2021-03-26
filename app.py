from flask import Flask, render_template, request
import requests
import urllib.parse
from datetime import datetime
from mongoengine import Document, EmbeddedDocument
from mongoengine import connect
from mongoengine.fields import (
    DateTimeField,
    URLField,
    StringField,
    ObjectIdField,
    IntField,
    DictField,
    ListField,
    FloatField,
    EmbeddedDocumentListField
)

app = Flask(__name__)


db = connect(db="lau-test")


class FossilPhotos(EmbeddedDocument):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    url = URLField(required=True),
    age = FloatField(),
    description = StringField()


class LocalityQuery(Document):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    updated = DateTimeField(required=True)
    name = StringField(required=True),
    sites = IntField(required=True),
    fossils = IntField(required=True),
    underwater_age = FloatField(),
    taxa = DictField(),
    photos = EmbeddedDocumentListField(FossilPhotos)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/query", methods=["GET", "POST"])
def query():
    #global_id = request.args.get('id')
    # query = LocalityQuery.objects(uid=global_id)

    return "Hello, Salvador"    


@app.route("/json", methods=["GET", "POST"])
def json():
    if request.method == 'POST':
        #if LocalityQuery.objects(uid=globalId):
         #   return LocalityQuery.objects(uid=globalId)
        #else:

        feature =  request.json
        
        localities_url = 'https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities_View/FeatureServer/0/query'
        
        geometry = '{"spatialReference":{"latestWkid":3857,"wkid":102100},"rings":' + str(feature["geometry"]) + '}'
        data = {
            'f' : 'json',
            'geometry' : geometry,
            'maxRecordCountFactor': '3',
            'outFields': '*',
            'returnGeometry': 'false',
            'spatialRel': 'esriSpatialRelIntersects',
            'geometryType': 'esriGeometryPolygon',
            'inSR': '102100'
        }

        response = requests.post(localities_url, data=data)
        response = response.json()
        
        if 'error' in response.keys():
            return f'Response error code {response["error"]}'
        else: 
            return response
        

#.json["globalId"]} was sucesfully recevied'


@app.route("/salvador")
def salvador():
    return "Hello, Salvador"


if __name__ == "__main__":
    files = ['./static/css/styles.css', './static/js/app.js']
    app.run(debug=True, extra_files=files)
