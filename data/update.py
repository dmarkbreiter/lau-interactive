# Updates mongoDB collections with new data from hosted feature layers used in the
# LAU map interactive.
from data.mongo_connect import global_init
from arcgis.gis import GIS
from collections import Counter
from data.query import Query
from data.attachment import Attachment
from datetime import datetime
import json
import pandas as pd


# Return fearture layer item from ArcGIS Online
def get_portal_object(id):
    gis = GIS()
    agol_object = gis.content.get(id)
    return agol_object


# Updates localities by filtering spatial df by region type and iterating over
# all unique region names in returned dataframe
def update_localities(localities, photos_sdf):
    is_updated = check_if_updated(localities, Query)
    if not is_updated:
        localities_layer = localities.layers[0]
        localities_sdf = localities_layer.query().sdf
        for region in ['county', 'region', 'neighborhood']:
            iterate_over_regions(region, localities_sdf, photos_sdf)


def update_attachments(photos):
    #is_updated = check_if_updated(photos, Attachment())
    #if not is_updated:
    photos_layer = photos.layers[0]
    photos_sdf = photos_layer.query().sdf
    attachments_sdf = pd.DataFrame.from_dict(photos_layer.attachments.search())
    cols = ['PARENTOBJECTID', 'NAME', 'DOWNLOAD_URL']
    merged_sdf = photos_sdf.merge(attachments_sdf[cols], left_on='ObjectId', right_on='PARENTOBJECTID')
    attachments_saved = 0
    for i in range(len(merged_sdf)):
        row = merged_sdf.iloc[i]
        attachment = Attachment()
        if Attachment.objects(specimen_id=row.specimenID):
            attachment.id = Attachment.objects(specimen_id=row.specimenID)[0].id
        attachment.specimen_id = row.specimenID
        attachment.modified = datetime.now()
        attachment.locality = row.locality
        attachment.taxon = row.taxon
        attachment.age = row.age
        attachment.description = row.description
        attachment.point = [row.longitude, row.latitude]
        attachment.geometry = row.SHAPE
        attachment.county = row.county
        attachment.region = row.region
        attachment.neighborhood = row.neighborhood
        attachment.url = row.DOWNLOAD_URL
        attachment.save()
        print(f'Attachment {row.specimenID} saved to attachments!')
        attachments_saved += 1
    print(f'{attachments_saved} attachment(s) succesfully saved')
    return merged_sdf


# Tests if database is up to date by testing against last modified
# timestamp of localities hosted feature layer
def check_if_updated(agol_object, Collection):
    object_last_modified = datetime.fromtimestamp(agol_object.modified/ 1e3)
    try:
        collection_last_modified = Collection.objects[0].modified
        if collection_last_modified > object_last_modified:
            return False
        else:
            return True
    except IndexError:
        print (f'No documents exist in {Collection}')


# Creates a new document for each region feature in specified region type
def iterate_over_regions(region_type, sdf, photos_sdf):
    region_list = sdf[region_type].to_list()
    unique_names = list(set(region_list))
    for region_name in unique_names:
        if region_name is not None:
            returned_rows = filter_df(sdf, region_type, region_name)
            region_taxa = process_taxa(returned_rows.taxa.to_list())
            returned_photos = filter_df(photos_sdf, region_type, region_name)['specimenID'].to_list()
            # Create new query document in Query collection
            query = Query()
            # By using the same id as existing record, query.save() will
            # overwrite existing record, as opposed to creating duplicates
            if Query.objects(name=region_name):
                query.id = Query.objects(name=region_name)[0].id
            query.name = region_name
            query.region = region_type
            query.modified = datetime.now()
            query.number_of_sites = len(returned_rows)
            query.taxa = region_taxa
            query.number_of_specimens = sum(region_taxa.values())
            # Get list of specimen IDs from photos sdf based on their region name value
            query.photos = [Attachment.objects(specimen_id=x)[0] for x in returned_photos]
            query.save()
            print(f'Sucessfully saved {region_name} to db!')


# Return df based on loc query of dataframe
def filter_df(df, field, value):
    return df.loc[df[field] == value]


# Return a dictionary from list of taxa that summarizes taxa from
# stringified json form
def process_taxa(taxa_list):
    taxa_dict = {}
    for taxa in taxa_list:
        if taxa:
            taxa = json.loads(taxa)
            taxa_dict = dict(Counter(taxa_dict) + Counter(taxa))
    return taxa_dict


if __name__ == '__main__':
    global_init()
    localities = get_portal_object('2ee7d9319663454996af081d337f9a4b')
    photos = get_portal_object('54cf1a9a79524a0d9af4952b0f05ef3f')
    photos_sdf = update_attachments(photos)
    update_localities(localities, photos_sdf)




