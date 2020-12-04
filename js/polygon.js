import { resetSplide, formatHTMLForSplide, newSplide, splide } from "../js/splideFunctions.js";

require([
  "esri/Map", 
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Sketch/SketchViewModel",
  "esri/Graphic",
  "esri/tasks/support/AttachmentQuery",
  "esri/Basemap", 
  "esri/layers/VectorTileLayer",
  "esri/widgets/Zoom/ZoomViewModel",
  "esri/layers/support/LabelClass"
  ], function (Map,
               MapView, 
               FeatureLayer,
               GraphicsLayer,
               SketchViewModel,
               Graphic, 
               AttachmentQuery, 
               Basemap,
               VectorTileLayer,
               ZoomViewModel,
               LabelClass
               ){

  // Initialize variable
  var view, 
      map, 
      localitiesLayer,
      countiesLayer,
      regionsLayer,
      neighborhoodsLayer,
      localityLayerView,
      highlight,
      polygonHighlight,
      sketchGraphicsLayer, 
      selectedFeatureGraphicLayer,
      sketchViewModel, 
      attachmentList,
      slidePagination,
      zoomViewModel,
      splideHighlight,
      geometryOffset,
      fossilsFound,
      invertCount,
      vertCount,
      queriedLocalities,
      featureName,
      countiesMaxScale,
      regionsMaxScale,
      neighborhoodsMinScale,
      regionsClientLayer;


  // Get DOM elements 
  var infoDiv = document.getElementById("infoDiv");
  var sliderDiv = document.getElementById("sliderDiv");
  var noFossilsDiv = document.getElementById("noFossilsDiv");
  var zoomDiv = document.getElementById("zoomDiv");
  var zoomInDiv = document.getElementById("zoom-in");
  var zoomOutDiv = document.getElementById("zoom-out");
  var featureCountDiv = document.getElementById("featureCount");
  var invertCountDiv = document.getElementById("invertCount");
  var vertCountDiv = document.getElementById("vertCount");

  infoDiv.style.display = "none";
  noFossilsDiv.style.display = "none";


  setUpMap();

  
  // Add event listeners to custom widgets
  document.getElementById("select-by-polygon").addEventListener("click", polygonButtonClickHandler);
  document.getElementById("return-to-extent").addEventListener("click", resetButtonClickHandler);
  zoomInDiv.addEventListener("click", zoomInClickHandler);
  zoomOutDiv.addEventListener("click", zoomOutClickHandler)

  /* ==========================================================
   Event handler functions
  ========================================================== */

  // Event handler for reset widget
  function resetButtonClickHandler() {
    sketchViewModel.cancel();
    view.goTo({center:[-118.248638, 34.062660], zoom:8});
    if (highlight) {
      highlight.remove()
    }
    if (polygonHighlight) {
      polygonHighlight.remove();
    }
    clearGraphics();
    clearWidgets();
  }

  // Click event for the SketchViewModel widget
  function polygonButtonClickHandler() {
    if (polygonHighlight) {
      polygonHighlight.remove();
    }
    noFossilsDiv.style.display = "none";
    featureName = ""
    clearGraphics();
    sketchViewModel.create("polygon", {mode: "freehand"});
    
  };

  // Click event for the Zoom widgets
  function zoomInClickHandler() {
    zoomViewModel.zoomIn();

  }
  function zoomOutClickHandler() {
    zoomViewModel.zoomOut();

  }

  // Click event for Counties layer
  view.on("click", function (event) {
    clearGraphics();
    noFossilsDiv.style.display = "none";
    if (view.scale > countiesMaxScale) {
      selectFeaturesFromClick(event, countiesLayer)
    } else if (view.scale > regionsMaxScale) {
      selectFeaturesFromClick(event, regionsLayer)
    } else if (neighborhoodsMinScale > view.scale) {
      selectFeaturesFromClick(event, neighborhoodsLayer)
    }
  });


  function selectFeaturesFromClick(screenPoint, layer) {
    const point = view.toMap(screenPoint);

    var clickQuery = {
      geometry: point,
      spatialRelationship: "intersects",
      distance: 50,
      units: "meters",
      returnGeometry: true,
      outFields: ["*"]
    }

    layer.queryFeatures(clickQuery).then(function(results){
      var clickFeature = results.features[0];
      console.log(clickFeature)
      featureName = results.features[0].attributes["name"]
      selectFeatures(clickFeature);

      const selectedFeatureGraphic = new Graphic({
        geometry: clickFeature.geometry,
        symbol: {
          type: "simple-fill",
          color: [0, 185, 235, 0.2],
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [0, 185, 235, 1],
            width: 4 // points
          }
        }
      });
      selectedFeatureGraphicLayer.graphics.removeAll()
      selectedFeatureGraphicLayer.graphics.add(selectedFeatureGraphic);   
    })
   }


  function createSplideFromAttachments(layer, ids) {
    resetSplide();
  // Query to retrieve attachments  
  var attachmentQuery = new AttachmentQuery({
    objectIds: ids,
  });
    layer.queryAttachments(attachmentQuery).then(function(attachments){
      attachmentList = Object.values(attachments).map(attachment => attachment[0])

    // Retrieve list of urls of attached images from selected localities
    attachmentList.forEach(attachment => {
      formatHTMLForSplide(attachment)
    })

    // Create new Splide image slider and set container div to visible
    slidePagination = document.getElementById("slidePagination");
    if (slidePagination) {
      slidePagination.remove()
    }

    if (attachmentList.length > 0) {
      sliderDiv.style.display = "block";
      newSplide();

      // Create graphic at initial Splide slide
      createPointGraphicAtObjectId(attachmentList[0].parentObjectId)
      
      // Splide event listener
      splide.on( 'active', function(slide) {
        if (splideHighlight) {
          splideHighlight.remove();
        }
        const slideObjectId = slide.slide.classList[1]
        createPointGraphicAtObjectId(slideObjectId)
      });
      } else {
        sliderDiv.style.display ="none";
      }
    })
  }

  /* ==========================================================
    Function selects features that intersect with Sketch geometry
    ========================================================== */
  function selectFeatures(polygon) {
    var geometry = polygon.geometry;

    // Clear old text from infoDiv
    infoDiv.childNodes.forEach(node => node.innerHTML = "");
    resetSplide();
    clearWidgets;

    // Define Queries
    var query = {
      geometry: geometry,
      spatialRelationship: "intersects",
      outFields: ["*"]
    };


    // Query graphics from the feature layer view.
    localitiesLayer.queryFeatures(query).then(function(results) {
      queriedLocalities = results.features;

      // Get counts of Invert/Vert localities based on Category field of 'attributes' property of selected locality records
      var objectIds = queriedLocalities.map(loc => loc["attributes"]["ObjectId"])
      invertCount = queriedLocalities.filter(loc => loc["attributes"]["Category"] == "Invertebrate").length;
      vertCount = queriedLocalities.filter(loc => loc["attributes"]["Category"] == "Vertebrate").length;
      
      // Function to get attachments and display splide
      createSplideFromAttachments(localitiesLayer, objectIds)

      geometryOffset = -(geometry.extent.width/2)
      var geometryExpand = (286976 / geometry.extent.width + .91)
      

    
      if (polygon.layer.maxScale) {
        view.goTo({
          center: geometry.centroid.offset(geometryOffset*.65, 0),
          scale: polygon.layer.maxScale / 2
        }).catch(function(error){
          if (error.name != "AbortError") {
            console.error(error);
          }
        })
      } else {
        view.goTo(geometry.extent.expand(2).offset(geometryOffset,0)).catch(function(error){
          if (error.name != "AbortError") {
            console.error(error);
          }
        })
      }
      

      // If records are returned from locality query
      if (queriedLocalities.length > 0) {
        infoDiv.style.display = "initial";
        // Send info to div
        fossilsFound = queriedLocalities.length.toString();
        if (featureName) {
          featureCountDiv.innerHTML = "<b>" + fossilsFound + "</b>" + " fossils found in </br>" + featureName + "!"
        } else {
          featureCountDiv.innerHTML = "<b>" + fossilsFound + "</b>" + " fossils found in </br> the area!"
        }

        invertCountDiv.innerHTML += "<b>" + invertCount + "</b>" + " invertebrates"
        vertCountDiv.innerHTML += "<b>" + vertCount + "</b>" + " vertebrates"
      } else {
        clearWidgets();
        noFossilsDiv.style.display = "initial";
      };

      // Remove exisiting highlighted features
      if (highlight) {
        highlight.remove();
      }
      // Highlight query results
      highlight = localityLayerView.highlight(queriedLocalities) 
      
    });
  }

  // Add selectFeatures function to creation of new Sketch
  sketchViewModel.on("create", function (event){
    if (event.state === "complete") {
      // This polygon will be used to query features that intersect it;
      console.log(event.graphic)
      selectFeatures(event.graphic);
    }
  });

  function createPointGraphicAtObjectId(objectId) {
    var highlightQuery = {
      objectIds: [objectId],
      outFields: ["*"]
    };
    localitiesLayer.queryFeatures(highlightQuery).then(function(attachment){
      var visibleAttachmentGeometry = {
        type: "point",  // autocasts as new Point()
        longitude: attachment.features[0].attributes.LONGITUDE,
        latitude: attachment.features[0].attributes.LATITUDE
      };
    
      // Create graphic around record currntly being displayed in Splide carousel
      const selectedGraphic = new Graphic({
        geometry: visibleAttachmentGeometry,
        symbol: {
          type: "simple-marker",
          style: "circle",
          color: "orange",
          size: "12px", // pixels
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [255, 255, 0],
            width: 2 // points
          }
        }
      });
      view.graphics.removeAll()
      view.graphics.add(selectedGraphic);   
    })
  };

  // Functions to clear divs from view
  function clearWidgets() {
    sliderDiv.style.display = "none";
    infoDiv.style.display = "none";
    noFossilsDiv.style.display = "none";
  }

  function clearGraphics() {
    sketchGraphicsLayer.removeAll();
    selectedFeatureGraphicLayer.removeAll();
    view.graphics.removeAll()
  }


  /* ==========================================================
    Function to set up the view, map and add widgets & layers
    ========================================================== */

  function setUpMap () {
    // Create new Basemap
    var basemap = new Basemap({
      baseLayers: [
      new VectorTileLayer({
        portalItem: {
          id: "dcd864fb78f744f18951caa7451ba540" // Modified Grey Basemap
          }
        })
      ]
    });

    map = new Map({
      basemap: basemap
    });

    view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-118.248638, 34.062660], // longitude, latitude , 
      zoom: 8,
      popup: {
        autoOpenEnabled: false
      },
      highlightOptions: {
        color: [0, 185, 235, .75],
        fillOpacity: 0.4
      },
      ui : {
        components: []
      }
    });

    // Create new GraphicLayers
    sketchGraphicsLayer = new GraphicsLayer();
    map.add(sketchGraphicsLayer);

    selectedFeatureGraphicLayer = new GraphicsLayer();
    map.add(selectedFeatureGraphicLayer)

    // Create the new sketch view model and sets its layer
    sketchViewModel = new SketchViewModel({
      view: view,
      layer: sketchGraphicsLayer,
      updateOnGraphicClick: false,
      polygonSymbol: {
        type: "simple-fill",
        color: [0, 185, 235, 0.2],
        size: "1px",
        outline: {
          color: [0, 185, 235, 0.5],
          width: "3px"
        }
      }
    });

    zoomViewModel = new ZoomViewModel({
      view: view
    })
    
    // Configure widget icons 
    var drawContainer = document.getElementById("select-by-polygon");
    var drawSvg = document.getElementById("brush-path")

    drawContainer.addEventListener("click", function(event) {
      event.preventDefault;
      drawSvg.classList.remove("draw-animation");
      drawContainer.offsetWidth;
      drawSvg.classList.add("draw-animation");
    }, false)

    var resetContainer = document.getElementById("return-to-extent");
    var resetSvg = document.getElementById("reset-widget")

    resetContainer.addEventListener("click", function(event) {
      event.preventDefault;
      resetSvg.classList.remove("reset-animation");
      resetContainer.offsetWidth;
      resetSvg.classList.add("reset-animation");         
    }, false)

    // Create renderers, LabelClasses and FeatureLayers 
    const localitiesRenderer = {
      type: "simple",
      symbol: {
        type: "simple-marker",
        size: 6,
        color: [20, 204, 180, 0.5],
        outline: {
            width: 0.5,
            color: [247, 247, 247, 0.5]
        }
      }
    };

    const polygonFeatureRenderer = {
      type: "simple",
      symbol: {
        type: "simple-fill",
        style: "none",
        outline : {
          color: [128, 128, 128, 0.5],
          width: "1.5px"
        }
      }
    }  

    const countiesLabelClass = new LabelClass({
      labelExpressionInfo: { expression: "$feature.NAME" },
      symbol: {
        type: "text",  // autocasts as new TextSymbol()
        color: "black",
        haloSize: 0.5,
        haloColor: "white",
        font: {  // autocast as new Font()
          family: "Avenir Next LT Pro Regular",
          weight: "bold",
          size: 13
        }
      }
    });

    const regionsLabelClass = new LabelClass({
      labelExpressionInfo: { expression: "$feature.NAME" },
      symbol: {
        type: "text",  // autocasts as new TextSymbol()
        color: "black",
        haloSize: 0.5,
        haloColor: "white",
        deconflictionStrategy: "static",
        font: {  // autocast as new Font()
          family: "Avenir Next LT Pro Regular",
          weight: "normal",
          size: 9.5
        }
      }
    });

    countiesMaxScale = 1155581;
    regionsMaxScale = 288895;
    neighborhoodsMinScale = 144448;

    localitiesLayer = new FeatureLayer({
      url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities/FeatureServer/0",
      renderer: localitiesRenderer
    });

    countiesLayer = new FeatureLayer({
      url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties/FeatureServer/0",
      maxScale: countiesMaxScale,
      labelingInfo: [countiesLabelClass],
      renderer: polygonFeatureRenderer
    });

    regionsLayer = new FeatureLayer({
      url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_County_Subdivisions/FeatureServer/0",
      minScale: countiesMaxScale,
      maxScale: regionsMaxScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer
    });

    neighborhoodsLayer = new FeatureLayer({
      url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods___Cities/FeatureServer/0",
      minScale: neighborhoodsMinScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer
    });

    // Add all features layers to map
    map.addMany([neighborhoodsLayer, regionsLayer, countiesLayer, localitiesLayer])


    // Add widgets to view
    //view.ui.components = [];
    view.ui.add("select-by-polygon", "top-right");
    view.ui.add("return-to-extent", "top-right");
    view.ui.add(infoDiv, "top-left");
    view.ui.add(sliderDiv, "top-left");
    view.ui.add(noFossilsDiv, "top-left");
    view.ui.add(zoomDiv, "bottom-right");

    // Set localityLayerView to layerView when localities are selected (for highlight)
    view.whenLayerView(localitiesLayer).then(function (layerView) {
      localityLayerView = layerView;
    });

  }
})