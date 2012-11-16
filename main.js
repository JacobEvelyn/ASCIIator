"use strict";

/*
Jacob Evelyn
Nov. 16, 2012

This is the JavaScript code for a website that transforms user-uploaded
images into ASCII art, using only client-side JavaScript.
*/

/*
This is a convenience object for storing data (red, green, blue, alpha)
about a point in an image.

r = red
g = green
b = blue
a = alpha
*/
var Point = function(r, g, b, a) {
	return {
		red: r,
		green: g,
		blue: b,
		alpha: a
	}
}

/*
This object represents a 2D matrix of points.

w = width
h = height
*/
var PointMatrix = function(w, h) {
	var width = w;
	var height = h;
	
	// Internally, we can store the matrix as a 1D array.
	var arr = [];
	
	var getPoint = function(x, y) {
		return arr[y*width + x]; // Calculate point index in array and return it.
	}
	
	var setPoint = function(x, y, point) {
		arr[y*width + x] = point; // Set new point.
	}
	
	// Make properties, getters, and setters available to public.
	return {
		width: width,
		height: height,
		getPoint: getPoint,
		setPoint: setPoint
	}
}

/*
This singleton object stores all relevant DOM elements to be easily
accessed through JavaScript. (Note that these elements are initialized
after the window.onload event, by controller.initializeDOM().)

This object also provides methods for hiding and showing any DOM element,
using the .hidden CSS selector.
*/
var DOM = (function() {
	var hideElement = function(elmt) {
		elmt.className += " hidden";
	}
	
	var showElement = function(elmt) {
		elmt.className = elmt.className.replace(/\s*hidden/g, "");
	}
	
	return {
		hideElement: hideElement,
		showElement: showElement
	}
})();

/*
This singleton object stores all relevant data regarding the
program's state. Currently, this is only whether or not we are
in color or black-and-white draw mode.
*/
var state = (function() {
	var isColorMode;
	
	return {
		isColorMode: isColorMode
	}
})();

/*
This singleton object performs all of the relevant image reading
and writing at the heart of the image-to-ASCII-image process.

Note that its methods are chainable. Though chaining is not used
currently, it is helpful for testing to be able to call:
imageManipulator.setImageData(...).computeMatrix(...).convertToASCII(...);
*/
var imageManipulator = (function() {
	var imageData; // The stored data from the uploaded image.
	var pointMatrix; // The matrix of average color values, to select text color.
	var xSpacing; // How far apart to draw letters horizontally.
	var ySpacing; // How far apart to draw letters vertically.
	
	// Loads newImageData into imageData.
	var setImageData = function(newImageData) {
		imageData = newImageData;
		return this; // For chaining.
	}
	
	// Compute the PointMatrix of average color values for each xSpace-by-ySpace
	// block of pixels.
	var computeMatrix = function(xSpace, ySpace) {
		if (typeof imageData === "undefined") {
			return this; // For chaining.
		}
		
		// Variables for summations of red, green, blue, and alpha values.
		var rSum, gSum, bSum, aSum, rAvg, gAvg, bAvg, aAvg;
		
		// Various index variables.
		var xIndex, yIndex, x, y, dataIndex;
		
		// Store spacing values for use in drawing with convertToASCII().
		xSpacing = xSpace;
		ySpacing = ySpace;
		
		// Create the PointMatrix. Round down for dimensions to avoid conditions where a
		// matrix point contains some relevant data and some undefined pixels.
		pointMatrix = new PointMatrix(Math.floor(imageData.width/xSpacing), Math.floor(imageData.height/ySpacing));
		
		var numElementsToAvg = xSpacing*ySpacing; // Compute the number of input pixels in each point.
		
		// Loop through each block of pixels, and save the average red, green, blue, and
		// alpha values in a point in the matrix, to be used in drawing.
		for (xIndex = 0; xIndex < imageData.width - (xSpacing - 1); xIndex += xSpacing) {
			for (yIndex = 0; yIndex < imageData.height - (ySpacing - 1); yIndex += ySpacing) {
				rSum = 0;
				gSum = 0;
				bSum = 0;
				aSum = 0;
				
				// Loop through each pixel in a block and do the summation.
				for (x = 0; x < xSpacing; x++) {
					for (y = 0; y < ySpacing; y++) {
						dataIndex = (yIndex + y)*imageData.width*4 + (xIndex + x)*4;
						
						// Add red, green, blue, and alpha values.
						rSum += imageData.data[dataIndex];
						gSum += imageData.data[dataIndex + 1];
						bSum += imageData.data[dataIndex + 2];
						aSum += imageData.data[dataIndex + 3];
					}
				}
				
				// Compute RGBA averages.
				rAvg = rSum/numElementsToAvg;
				gAvg = gSum/numElementsToAvg;
				bAvg = bSum/numElementsToAvg;
				aAvg = aSum/numElementsToAvg;
				
				// Store the values for later drawing.
				pointMatrix.setPoint(xIndex/xSpacing, yIndex/ySpacing, new Point(rAvg, gAvg, bAvg, aAvg));
			}
		}
		
		return this; // For chaining.
	}
	
	// Convert the stored PointMatrix data into output ASCII on the canvas.
	// bgColor = The hex value of the output image's desired background color. User-selected.
	// str = The string to be used for color images. Also selected by the user.
	var convertToASCII = function(bgColor, str) {
		// If our matrix doesn't exist, fail gracefully.
		if (typeof pointMatrix === "undefined") {
			return this; // For chaining.
		}
		
		var charIndex = 0;
		var greyscaleStr = "MND8OV%$7I?+=~:,."; // Our characters to use in greyscale conversion, from heaviest to lightest.
		var luminance;
		var fontSize = parseInt(DOM.fontSizeRange.value); // Conversion to int isn't necessary here as we'll convert it right back,
													 	  // but it helps avoid errors if we want the number.
		var fontName = "Courier";
		var point;
		
		DOM.outputCanvas.width = imageData.width;
		DOM.outputCanvas.height = imageData.height;
		DOM.outputContext.font = fontSize + "pt " + fontName; // pt = exact pixel font.
		
		// Draw the background color.
		DOM.outputContext.fillStyle = bgColor;
		DOM.outputContext.fillRect(0, 0, imageData.width, imageData.height);
		
		// If we are in greyscale mode, use black characters for drawing.
		if (!state.isColorMode) {
			DOM.outputContext.fillStyle = "#000000";
		}
		
		// Loop through each point in the matrix, and draw a letter at the corresponding location
		// in the output image.
		for (var y = 0; y < pointMatrix.height; y++) {
			for (var x = 0; x < pointMatrix.width; x++) {
				point = pointMatrix.getPoint(x, y);
				
				// Allow for alpha drawing, if given inputs with alpha values.
				DOM.outputContext.globalAlpha = point.alpha/255;
				
				// If we're in color mode, print the user's text at the average input color.
				if (state.isColorMode) {
					DOM.outputContext.fillStyle = "rgb(" + Math.round(point.red) + ", " +
														   Math.round(point.green) + ", " +
														   Math.round(point.blue) + ")";
					DOM.outputContext.fillText(str.charAt(charIndex), x*xSpacing, y*ySpacing + fontSize); // Adding fontSize here provides less variation than choosing a fixed canvas textBaseline ("hanging" or "top").
					charIndex = (charIndex + 1) % str.length;
				} else { // If we're in black-and-white mode, print the character corresponding to the point's luminance.
					luminance = 0.2126*point.red + 0.7152*point.green + 0.0722*point.blue; // Compute the point's luminance value.
					charIndex = Math.round((greyscaleStr.length - 1)*(luminance/255)); // Select the appropriate ASCII character.
					DOM.outputContext.fillText(greyscaleStr.charAt(charIndex), x*xSpacing, y*ySpacing + fontSize);
				}
			}
		}
		
		return this; // For chaining.
	}
	
	// Return the functions to be used.
	return {
		setImageData: setImageData,
		computeMatrix: computeMatrix,
		convertToASCII: convertToASCII
	}
})();

/*
This singleton object is the "brains" of the program. It checks for browser feature
support and determines if the browser can run the website. If so, it initializes the
objects and DOM event listeners. If not, it fails gracefully and tells the user to
update the browser. Note that for non-necessary features, an upgrade message is still
displayed but the browser is allowed to continue.
*/
var controller = (function() {
	/*
	This function checks for browser support of necessary and non-necessary features
	this site uses. Features checked are:
	-HTML5 canvas (necessary)
	-FileReader (necessary)
	-addEventListener (necessary)
	-oninput events
	-link download attribute
	-color chooser
	
	This function returns true if all necessary features are supported, and false otherwise.
	*/
	var checkSupport = function() {
		var colorTester, downloadTester;
		var msg;
		var str = "Your browser does not support ";
		var strArr = []; // A list of the unsupported features. Empty if fully supported.
		var codeRunnable = true; // Will be false if a necessary feature is not supported.
		
		// Check canvas element support.
		if (!window.CanvasRenderingContext2D) {
			strArr.push("canvas elements");
			codeRunnable = false;
		}
		
		// Check FileReader support.
		if (!window.FileReader) {
			strArr.push("client-side file reading");
			codeRunnable = false;
		}
		
		// Check addEventListener support.
		if (!window.addEventListener) {
			strArr.push("standard event binding");
			codeRunnable = false;
		}

		// Check oninput support.
		window.oninput = function() {};
		if (!window.oninput) {
			strArr.push("certain input events");
		}
		window.oninput = null;
		
		// Check link download attribute support.
		downloadTester = document.createElement("a");
		if (typeof downloadTester.download === "undefined") {
			strArr.push("client-side file downloads");
		}
		
		// Check color chooser support.
		colorTester = document.createElement("input");
		colorTester.type = "color";
		if (colorTester.type !== "color") {
			strArr.push("graphical color choosers");
		}
		
		// If at least one feature is not supported, print message.
		if (strArr.length > 0) {
			if (strArr.length === 1) {
				str += strArr[0];
			} else {
				str += strArr.slice(1).join(", ") + ", and " + strArr[0];
			}

			str += ".<br />";
			
			// If a crucial feature is not supported, tell user to update.
			if (codeRunnable) {
				str += "Update your browser for a better experience."
			} else {
				str += "Please update your browser to run this website.";
				DOM.hideElement(document.getElementById("UploadContainer"));
			}
			
			// Display message div.
			msg = document.createElement("div");
			msg.innerHTML = str;
			msg.className = "message";
			document.body.appendChild(msg);
		}
		
		// Return true if code can be run, false otherwise.
		return codeRunnable;
	}
	
	// Initializes the convenience storage of DOM elements in the "DOM" object.
	var initializeDOM = function() {
		DOM.inputCanvas = document.createElement("canvas");
		DOM.inputContext = DOM.inputCanvas.getContext("2d");
		DOM.outputCanvas = document.getElementById("OutputCanvas");
		DOM.outputContext = DOM.outputCanvas.getContext("2d");
		DOM.imageUploader = document.getElementById("ImageUploader");
		DOM.inputImage = document.getElementById("InputImage");
		DOM.xRange = document.getElementById("XSpacingRange");
		DOM.yRange = document.getElementById("YSpacingRange");
		DOM.fontSizeRange = document.getElementById("FontSizeRange");
		DOM.textInput = document.getElementById("TextInput");
		DOM.controls = document.getElementById("Controls");
		DOM.bgColorChooser = document.getElementById("BGColorChooser");
		DOM.downloadLink = document.getElementById("DownloadLink");
		DOM.colorModeButton = document.getElementById("ColorModeButton");
	}
	
	// Sets the controls for the current color mode.
	var setControlsForColorMode = function() {
		if (state.isColorMode) { // Switching to colored mode.
			DOM.colorModeButton.value = "NOW BLACK 'N' WHITE!";
			DOM.showElement(DOM.textInput);
		} else {
			DOM.colorModeButton.value = "NOW COLOR!";
			DOM.hideElement(DOM.textInput);
		}
	}
	
	// Initializes the state of the program (currently just the color mode).
	var initializeState = function() {
		state.isColorMode = true;
		setControlsForColorMode();
	}
	
	// Returns the text string to be displayed.
	var getText = function() {
		return DOM.textInput.value || DOM.textInput.placeholder;
	}
	
	// Returns the background color to be drawn.
	var getBGColor = function() {
		return DOM.bgColorChooser.value;
	}
	
	// Updates the download link.
	var updateDownloadLink = function() {
		DOM.downloadLink.href = DOM.outputCanvas.toDataURL("image/png");
	}
	
	// Draws the ASCII art in the canvas.
	var doASCII = function() {
		imageManipulator.convertToASCII(getBGColor(), getText());
		updateDownloadLink();
	}
	
	// Computes the PointMatrix for the input with given spacing sizes,
	// and then draws the ASCII art using doASCII().
	var computeAndDoASCII = function() {
		var xRange = parseInt(DOM.xRange.value);
		var yRange = parseInt(DOM.yRange.value);
		imageManipulator.computeMatrix(xRange, yRange); // Compute with new block sizes.
		
		doASCII(); // Draw ASCII art.
	}
	
	// Loads the uploaded image from src, then computes the PointMatrix
	// and draws the ASCII art using computeAndDoASCII().
	var loadComputeAndDoASCII = function(src) {
		var img = new Image();
		
		// Use onload to ensure we wait for the image to be transferred fully.
		img.onload = function() {
			// In case the preview box for the original input image was hidden (as initially), show it.
			DOM.showElement(DOM.inputImage);
			
			DOM.inputCanvas.width = img.width;
            DOM.inputCanvas.height = img.height;
            DOM.inputContext.drawImage(img, 0, 0);
			
			imageManipulator.setImageData(DOM.inputContext.getImageData(0, 0, img.width, img.height));
			
			computeAndDoASCII();
			
			// In case controls and output were hidden (as initially), show them.
			DOM.showElement(DOM.controls);
			DOM.showElement(DOM.outputCanvas);
	    }
	    img.src = src;
		DOM.inputImage.src = src;
	}
	
	
	// Switch the current drawing color mode, change the appropriate controls,
	// and redraw the output image.
	var switchColorMode = function() {
		state.isColorMode = !state.isColorMode;
		
		setControlsForColorMode();
		
		doASCII();
	}
	
	// Handle the input image upload event, calling loadComputeAndDoASCII() to
	// perform computation and drawing tasks.
	var handleUpload = function(e) {
		var fileReader = new FileReader();
		
		// Use onload to ensure we wait for the image to be uploaded fully.
		fileReader.onload = function(event) {
			loadComputeAndDoASCII(event.target.result);
		}
		fileReader.readAsDataURL(e.target.files[0]);
	}
	
	// Initialize all user input event handlers.
	var initializeEvents = function() {
		DOM.imageUploader.addEventListener("change", handleUpload);
		DOM.xRange.addEventListener("change", computeAndDoASCII);
		DOM.yRange.addEventListener("change", computeAndDoASCII);
		DOM.fontSizeRange.addEventListener("change", doASCII);
		DOM.textInput.addEventListener("input", doASCII);
		DOM.bgColorChooser.addEventListener("input", doASCII);
		DOM.colorModeButton.addEventListener("click", switchColorMode)
	}
	
	// Perform feature check, and if all necessary features are supported,
	// initialize everything.
	var initialize = function() {
		if (checkSupport()) {
			initializeDOM();
			initializeState();
			initializeEvents();
		}
	}
	
	// Return the only externally-called function: initialize.
	return {
		initialize: initialize
	}
})();

// Wait for the DOM to be loaded before trying to initialize the program.
window.onload = controller.initialize;