// This script exports photoshop layers as individual PNGs. It also
// writes a JSON file that can be imported into Spine where the images
// will be displayed in the same positions and draw order.

// Setting defaults.
var writePngs = true;
var writeTemplate = false;
var writeJson = true;
var ignoreHiddenLayers = true;
var pngScale = 1;
var groupsAsSkins = false;
var useRulerOrigin = false;
var imagesDir = "./images/";
var projectDir = "";
var padding = 1;

// IDs for saving settings.
const settingsID = stringIDToTypeID("settings");
const writePngsID = stringIDToTypeID("writePngs");
const writeTemplateID = stringIDToTypeID("writeTemplate");
const writeJsonID = stringIDToTypeID("writeJson");
const ignoreHiddenLayersID = stringIDToTypeID("ignoreHiddenLayers");
const groupsAsSkinsID = stringIDToTypeID("groupsAsSkins");
const useRulerOriginID = stringIDToTypeID("useRulerOrigin");
const pngScaleID = stringIDToTypeID("pngScale");
const imagesDirID = stringIDToTypeID("imagesDir");
const projectDirID = stringIDToTypeID("projectDir");
const paddingID = stringIDToTypeID("padding");

var originalDoc;
try {
	originalDoc = app.activeDocument;
} catch (ignored) {}
var settings, progress;
loadSettings();
showDialog();

function tenNum()
{
	return '1' + Math.floor((Math.random() * 9 + 1) * 0x10000000)
      .toString(10)
      .substring(1);
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function run () {
	// Output dirs.
	var absProjectDir = absolutePath(projectDir);
	new Folder(absProjectDir).create();
	var absImagesDir = absolutePath(imagesDir);
	var imagesFolder = new Folder(absImagesDir);
	imagesFolder.create();
	var relImagesDir = imagesFolder.getRelativeURI(absProjectDir);
	relImagesDir = relImagesDir == "." ? "" : (relImagesDir + "/");

	// Get ruler origin.
	var xOffSet = 0, yOffSet = 0;
	if (useRulerOrigin) {
		var ref = new ActionReference();
		ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
		var desc = executeActionGet(ref);
		xOffSet = desc.getInteger(stringIDToTypeID("rulerOriginH")) >> 16;
		yOffSet = desc.getInteger(stringIDToTypeID("rulerOriginV")) >> 16;
	}

	activeDocument.duplicate();

	// Output template image.
	if (writeTemplate) {
		if (pngScale != 1) {
			scaleImage();
			storeHistory();
		}

		var file = new File(absImagesDir + "template");
		if (file.exists) file.remove();

		activeDocument.saveAs(file, new PNGSaveOptions(), true, Extension.LOWERCASE);

		if (pngScale != 1) restoreHistory();
	}

	if (!writeJson && !writePngs) {
		activeDocument.close(SaveOptions.DONOTSAVECHANGES);
		return;
	}

	// Rasterize all layers.
	try {
		executeAction(stringIDToTypeID( "rasterizeAll" ), undefined, DialogModes.NO);
	} catch (ignored) {}

	// Collect and hide layers.
	var layers = [];
	collectLayers(activeDocument, layers);
	var layersCount = layers.length;

	storeHistory();

	// Store the slot names and layers for each skin.
	var slots = {}, skins = { "default": [] };
	for (var i = layersCount - 1; i >= 0; i--) {
		var layer = layers[i];

		// Use groups as skin names.
		var potentialSkinName = trim(layer.parent.name);
		var layerGroupSkin = potentialSkinName.indexOf("-NOSKIN") == -1;
		var skinName = (groupsAsSkins && layer.parent.typename == "LayerSet" && layerGroupSkin) ? potentialSkinName : "default";

		var skinLayers = skins[skinName];
		if (!skinLayers) skins[skinName] = skinLayers = [];
		skinLayers[skinLayers.length] = layer;

		slots[layerName(layer)] = true;
	}

	//
	var docName = decodeURI(originalDoc.name);
		docName = docName.substring(0, docName.indexOf("."));
	var tagIndex = 74;
	var docWidth = activeDocument.width.as("px") * pngScale;
	var	docHeight = activeDocument.height.as("px") * pngScale;

	// Output skeleton and bones.
	var json = '<GameProjectFile>\n';
	json += '\t<PropertyGroup Type="Scene" Name="' + docName + '" ID="' + guid() + '" Version="2.1.5.0" />\n';
	json += '\t<Content ctype="GameProjectContent">\n';
	json += '\t\t<Content>\n';
	json += '\t\t<Animation Duration="0" Speed="1.0000" />\n';
	json += '\t\t<ObjectData Name="Scene" FrameEvent="" Tag="' + tagIndex + '" ctype="SingleNodeObjectData">\n';
	tagIndex += 1;
	json += '\t\t\t<Position X="0.0000" Y="0.0000" />\n';
	json += '\t\t\t<Scale ScaleX="1.0000" ScaleY="1.0000" />\n';
	json += '\t\t\t<AnchorPoint />\n';
	json += '\t\t\t<CColor A="255" R="255" G="255" B="255" />\n';
	json += '\t\t\t<Size X="' + docWidth + '" Y="' + docHeight + '" />\n';
	json += '\t\t\t<PrePosition X="0.0000" Y="0.0000" />\n';
	json += '\t\t\t<PreSize X="0.0000" Y="0.0000" />\n';
	json += '\t\t\t<Children>\n';

	// Output slots.
	// var slotsCount = countAssocArray(slots);
	// var slotIndex = 0;
	// for (var slotName in slots) {
	// 	if (!slots.hasOwnProperty(slotName)) continue;

	// 	// Use image prefix if slot's attachment is in the default skin.
	// 	var attachmentName = slotName;
	// 	var defaultSkinLayers = skins["default"];
	// 	for (var i = defaultSkinLayers.length - 1; i >= 0; i--) {
	// 		if (layerName(defaultSkinLayers[i]) == slotName) {
	// 			attachmentName = slotName;
	// 			break;
	// 		}
	// 	}

	// 	json += '\t{"name":"' + slotName + '","bone":"root","attachment":"' + attachmentName + '"}';
	// 	slotIndex++;
	// 	json += slotIndex < slotsCount ? ",\n" : "\n";
	// }
	// json += '],\n"skins":{\n';

	// Output skins.
	var skinsCount = countAssocArray(skins);
	var skinIndex = 0;
	for (var skinName in skins) {
		if (!skins.hasOwnProperty(skinName)) continue;
		// json += '\t"' + skinName + '":{\n';

		var skinLayers = skins[skinName];
		var skinLayersCount = skinLayers.length;
		var skinLayerIndex = 0;
		// for (var i = skinLayersCount - 1; i >= 0; i--) {
		for (var i = 0; i < skinLayersCount; i++) {
			var layer = skinLayers[i];
			var slotName = layerName(layer);
			var placeholderName, attachmentName;
			if (skinName == "default") {
				placeholderName = slotName;
				attachmentName = placeholderName;
			} else {
				placeholderName = slotName;
				attachmentName = skinName + "/" + slotName;
			}

			var x = activeDocument.width.as("px") * pngScale;
			var y = activeDocument.height.as("px") * pngScale;

			layer.visible = true;
			if (!layer.isBackgroundLayer) activeDocument.trim(TrimType.TRANSPARENT, false, true, true, false);
			x -= activeDocument.width.as("px") * pngScale;
			y -= activeDocument.height.as("px") * pngScale;
			if (!layer.isBackgroundLayer) activeDocument.trim(TrimType.TRANSPARENT, true, false, false, true);
			var width = activeDocument.width.as("px") * pngScale + padding * 2;
			var height = activeDocument.height.as("px") * pngScale + padding * 2;

			// Save image.
			if (writePngs) {
				if (pngScale != 1) scaleImage();
				if (padding > 0) activeDocument.resizeCanvas(width, height, AnchorPosition.MIDDLECENTER);

				if (skinName != "default") new Folder(absImagesDir + skinName).create();
				activeDocument.saveAs(new File(absImagesDir + attachmentName), new PNGSaveOptions(), true, Extension.LOWERCASE);
			}

			restoreHistory();
			layer.visible = false;

			x += Math.round(width) / 2;
			y += Math.round(height) / 2;

			// Make relative to the Photoshop document ruler origin.
			if (useRulerOrigin) {
				x -= xOffSet * pngScale;
				y -= activeDocument.height.as("px") * pngScale - yOffSet * pngScale; // Invert y.
			}

			json += '\t\t\t\t<NodeObjectData Name="' + slotName + '" ActionTag="' + tenNum() + '" FrameEvent="" Tag="' + tagIndex + '" ctype="SpriteObjectData">\n';
			tagIndex += 1;
			// json += '\t\t\t\t\t<Position X="' + (x - Math.round(width) * 0.5000) + '" Y="' + (y - Math.round(height) * 0.5000) + '" />\n';
			json += '\t\t\t\t\t<Position X="' + (x) + '" Y="' + (y) + '" />\n';
            json += '\t\t\t\t\t<Scale ScaleX="1.0000" ScaleY="1.0000" />\n';
            json += '\t\t\t\t\t<AnchorPoint ScaleX="0.5000" ScaleY="0.5000" />\n';
            json += '\t\t\t\t\t<CColor A="255" R="255" G="255" B="255" />\n';
            json += '\t\t\t\t\t<Size X="' + Math.round(width) + '" Y="' + Math.round(height) + '" />\n';
            json += '\t\t\t\t\t<PrePosition X="0.0000" Y="0.0000" />\n';
            json += '\t\t\t\t\t<PreSize X="0.0000" Y="0.0000" />\n';
            json += '\t\t\t\t\t<FileData Type="Normal" Path="' + relImagesDir + placeholderName + '.png" />\n';
			json += '\t\t\t\t</NodeObjectData>\n';
			// if (attachmentName == placeholderName) {
				// json += '\t\t"' + slotName + '":{"' + placeholderName + '":{'
					// + '"x":' + x + ',"y":' + y + ',"width":' + Math.round(width) + ',"height":' + Math.round(height) + '}}';
			// } else {
				// json += '\t\t"' + slotName + '":{"' + placeholderName + '":{"name":"' + attachmentName + '", '
					// + '"x":' + x + ',"y":' + y + ',"width":' + Math.round(width) + ',"height":' + Math.round(height) + '}}';
			// }

			skinLayerIndex++;
			// json += skinLayerIndex < skinLayersCount ? ",\n" : "\n";
		}
		//json += "\t\}";

		skinIndex++;
		// json += skinIndex < skinsCount ? ",\n" : "\n";
	}
	//json += '},\n"animations":{"animation":{}}\n}';
	json += '\t\t\t</Children>\n';
    json += '\t\t</ObjectData>\n';
    json += '\t\t</Content>\n';
	json += '\t</Content>\n';
	json += '</GameProjectFile>\n';

	activeDocument.close(SaveOptions.DONOTSAVECHANGES);

	// Output JSON file.
	if (writeJson) {
		var name = decodeURI(originalDoc.name);
		name = name.substring(0, name.indexOf("."));
		var file = new File(absProjectDir + name + ".csd");
		file.remove();
		file.open("w", "TEXT");
		file.lineFeed = "\n";
		file.write(json);
		file.close();
	}
}

// Dialog and settings:

function showDialog () {
	if (!originalDoc) {
		alert("Please open a document before running the LayersToPNG script.");
		return;
	}
	if (!hasFilePath()) {
		alert("Please save the document before running the LayersToPNG script.");
		return;
	}

	var dialog = new Window("dialog", "Layers To Cocos Studio 2 CSD");
	dialog.alignChildren = "fill";

	var checkboxGroup = dialog.add("group");
		var group = checkboxGroup.add("group");
			group.orientation = "column";
			group.alignChildren = "left";
			var writePngsCheckbox = group.add("checkbox", undefined, " Write layers as PNGs");
			writePngsCheckbox.value = writePngs;
			var writeTemplateCheckbox = group.add("checkbox", undefined, " Write a template PNG");
			writeTemplateCheckbox.value = writeTemplate;
			var writeJsonCheckbox = group.add("checkbox", undefined, " Write Spine JSON");
			writeJsonCheckbox.value = writeJson;
		group = checkboxGroup.add("group");
			group.orientation = "column";
			group.alignChildren = "left";
			var ignoreHiddenLayersCheckbox = group.add("checkbox", undefined, " Ignore hidden layers");
			ignoreHiddenLayersCheckbox.value = ignoreHiddenLayers;
			var groupsAsSkinsCheckbox = group.add("checkbox", undefined, " Use groups as skins");
			groupsAsSkinsCheckbox.value = groupsAsSkins;
			var useRulerOriginCheckbox = group.add("checkbox", undefined, " Use ruler origin as 0,0");
			useRulerOriginCheckbox.value = useRulerOrigin;

	var slidersGroup = dialog.add("group");
		group = slidersGroup.add("group");
			group.orientation = "column";
			group.alignChildren = "right";
			group.add("statictext", undefined, "PNG scale:");
			group.add("statictext", undefined, "Padding:");
		group = slidersGroup.add("group");
			group.orientation = "column";
			var scaleText = group.add("edittext", undefined, pngScale * 100);
			scaleText.characters = 4;
			var paddingText = group.add("edittext", undefined, padding);
			paddingText.characters = 4;
		group = slidersGroup.add("group");
			group.orientation = "column";
			group.add("statictext", undefined, "%");
			group.add("statictext", undefined, "px");
		group = slidersGroup.add("group");
			group.alignment = ["fill", ""];
			group.orientation = "column";
			group.alignChildren = ["fill", ""];
			var scaleSlider = group.add("slider", undefined, pngScale * 100, 1, 100);
			var paddingSlider = group.add("slider", undefined, padding, 0, 4);
	scaleText.onChanging = function () { scaleSlider.value = scaleText.text; };
	scaleSlider.onChanging = function () { scaleText.text = Math.round(scaleSlider.value); };
	paddingText.onChanging = function () { paddingSlider.value = paddingText.text; };
	paddingSlider.onChanging = function () { paddingText.text = Math.round(paddingSlider.value); };

	var outputGroup = dialog.add("panel", undefined, "Output directories");
		outputGroup.alignChildren = "fill";
		outputGroup.margins = [10,15,10,10];
		var textGroup = outputGroup.add("group");
			group = textGroup.add("group");
				group.orientation = "column";
				group.alignChildren = "right";
				group.add("statictext", undefined, "Images:");
				group.add("statictext", undefined, "JSON:");
			group = textGroup.add("group");
				group.orientation = "column";
				group.alignChildren = "fill";
				group.alignment = ["fill", ""];
				var imagesDirText = group.add("edittext", undefined, imagesDir);
				var projectDirText = group.add("edittext", undefined, projectDir);
		outputGroup.add("statictext", undefined, "Begin paths with \"./\" to be relative to the PSD file.").alignment = "center";

	var group = dialog.add("group");
		group.alignment = "center";
		var runButton = group.add("button", undefined, "OK");
		var cancelButton = group.add("button", undefined, "Cancel");
		cancelButton.onClick = function () {
			dialog.close(0);
			return;
		};

	function updateSettings () {
		writePngs = writePngsCheckbox.value;
		writeTemplate = writeTemplateCheckbox.value;
		writeJson = writeJsonCheckbox.value;
		ignoreHiddenLayers = ignoreHiddenLayersCheckbox.value;
		var scaleValue = parseFloat(scaleText.text);
		if (scaleValue > 0 && scaleValue <= 100) pngScale = scaleValue / 100;
		groupsAsSkins = groupsAsSkinsCheckbox.value;
		useRulerOrigin = useRulerOriginCheckbox.value;
		imagesDir = imagesDirText.text;
		projectDir = projectDirText.text;
		var paddingValue = parseInt(paddingText.text);
		if (paddingValue >= 0) padding = paddingValue;
	}

	dialog.onClose = function() {
		updateSettings();
		saveSettings();
	};
	
	runButton.onClick = function () {
		if (scaleText.text <= 0 || scaleText.text > 100) {
			alert("PNG scale must be between > 0 and <= 100.");
			return;
		}
		if (paddingText.text < 0) {
			alert("Padding must be >= 0.");
			return;
		}
		dialog.close(0);

		var rulerUnits = app.preferences.rulerUnits;
		app.preferences.rulerUnits = Units.PIXELS;
		try {
			run();
		} catch (e) {
			alert("An unexpected error has occurred.\n\nTo debug, run the LayersToPNG script using Adobe ExtendScript "
				+ "with \"Debug > Do not break on guarded exceptions\" unchecked.");
			debugger;
		} finally {
			if (activeDocument != originalDoc) activeDocument.close(SaveOptions.DONOTSAVECHANGES);
			app.preferences.rulerUnits = rulerUnits;
		}
	};

	dialog.center();
	dialog.show();
}

function loadSettings () {
	try {
		settings = app.getCustomOptions(settingsID);
	} catch (e) {
		saveSettings();
	}
	if (typeof settings == "undefined") saveSettings();
	settings = app.getCustomOptions(settingsID);
	if (settings.hasKey(writePngsID)) writePngs = settings.getBoolean(writePngsID);
	if (settings.hasKey(writeTemplateID)) writeTemplate = settings.getBoolean(writeTemplateID);
	if (settings.hasKey(writeJsonID)) writeJson = settings.getBoolean(writeJsonID);
	if (settings.hasKey(ignoreHiddenLayersID)) ignoreHiddenLayers = settings.getBoolean(ignoreHiddenLayersID);
	if (settings.hasKey(pngScaleID)) pngScale = settings.getDouble(pngScaleID);
	if (settings.hasKey(groupsAsSkinsID)) groupsAsSkins = settings.getBoolean(groupsAsSkinsID);
	if (settings.hasKey(useRulerOriginID)) useRulerOrigin = settings.getBoolean(useRulerOriginID);
	if (settings.hasKey(imagesDirID)) imagesDir = settings.getString(imagesDirID);
	if (settings.hasKey(projectDirID)) projectDir = settings.getString(projectDirID);
	if (settings.hasKey(paddingID)) padding = settings.getDouble(paddingID);
}

function saveSettings () {
	var settings = new ActionDescriptor();
	settings.putBoolean(writePngsID, writePngs);
	settings.putBoolean(writeTemplateID, writeTemplate);
	settings.putBoolean(writeJsonID, writeJson);
	settings.putBoolean(ignoreHiddenLayersID, ignoreHiddenLayers);
	settings.putDouble(pngScaleID, pngScale);
	settings.putBoolean(groupsAsSkinsID, groupsAsSkins);
	settings.putBoolean(useRulerOriginID, useRulerOrigin);
	settings.putString(imagesDirID, imagesDir);
	settings.putString(projectDirID, projectDir);
	settings.putDouble(paddingID, padding);
	app.putCustomOptions(settingsID, settings, true);
}

// Photoshop utility:

function scaleImage () {
	var imageSize = activeDocument.width.as("px");
	activeDocument.resizeImage(UnitValue(imageSize * pngScale, "px"), null, null, ResampleMethod.BICUBICSHARPER);
}

var historyIndex;
function storeHistory () {
	historyIndex = activeDocument.historyStates.length - 1;
}
function restoreHistory () {
	activeDocument.activeHistoryState = activeDocument.historyStates[historyIndex];
}

function collectLayers (layer, collect) {
	for (var i = 0, n = layer.layers.length; i < n; i++) {
		var child = layer.layers[i];
		if (ignoreHiddenLayers && !child.visible) continue;
		if (child.bounds[2] == 0 && child.bounds[3] == 0) continue;
		if (child.layers && child.layers.length > 0)
			collectLayers(child, collect);
		else if (child.kind == LayerKind.NORMAL) {
			collect.push(child);
			child.visible = false;
		}
	}
}

function hasFilePath () {
	var ref = new ActionReference();
	ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
	return executeActionGet(ref).hasKey(stringIDToTypeID("fileReference"));
}

function absolutePath (path) {
	path = trim(path);
	if (path.length == 0)
		path = activeDocument.path.toString();
	else if (imagesDir.indexOf("./") == 0)
		path = activeDocument.path + path.substring(1);
	path = path.replace(/\\/g, "/");
	if (path.substring(path.length - 1) != "/") path += "/";
	return path;
}

// JavaScript utility:

function countAssocArray (obj) {
	var count = 0;
	for (var key in obj)
		if (obj.hasOwnProperty(key)) count++;
	return count;
}

function trim (value) {
	return value.replace(/^\s+|\s+$/g, "");
}

function endsWith (str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function stripSuffix (str, suffix) {
	if (endsWith(str.toLowerCase(), suffix.toLowerCase())) str = str.substring(0, str.length - suffix.length);
	return str;
}

function layerName (layer) {
	return stripSuffix(trim(layer.name), ".png").replace(/[:\/\\*\?\"\<\>\|]/g, "");
}
