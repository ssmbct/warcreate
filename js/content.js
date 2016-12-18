/* global chrome, $ */
var server = 'http://warcreate.com'
var outlinks = []

function ab2str (buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf))
}

function fetchImage (u) {
  fetch(u)
  .then(function (res) {
    return resp.arrayBuffer()
  })
  .then(function (buffer) {
    return Promise.resolve(buffer)
  })
}

function getImageData () {
    var imgObjs = {}
    
    // Get image URIs from the DOM
    for (var image = 0; image < document.images.length; image++) {
      if (document.images[image].src.indexOf('data:') == -1) {
        imgObjs[document.images[image].src] = 'foo'; // dummy data to-be-filled below programmatically
      }
    }
    // Get image URIs embedded in CSS
    var imagesInCSS = getallBgimages()
    for (var imageInCSS = 0; imageInCSS < imagesInCSS.length; imageInCSS++) {
      imgObjs[imagesInCSS[imageInCSS]] = 'foo'; // dummy data to-be-filled below programmatically
    }

    var ret = {}

    var imgPromises = []
    // Create a promise for each image
    for (var uri in imgObjs) {
      imgPromises.push(uri)
    }

    return Promise.all(imgPromises)    
}

function generateOutlinks () {
    var outlinks = []
    
    // Img outlinks
    $(document.images).each(function () {
      outlinks.push($(this).attr('src') + ' E =EMBED_MISC')
    })

    // CSS outlinks
    $(document.styleSheets).each(function () {
      outlinks.push($(this).attr('href') + ' E =EMBED_MISC')
    })

    // JS outlinks
    $(document.scripts).each(function () {
      var src = ''
      if ($(this).attr('href')) {
        src = $(this).attr('href')
      } else if ($(this).attr('src')) {
        src = $(this).attr('src')
      }

      outlinks.push(src + ' E script/@src')
    })

    // outlinks as external links on page
    $('a').each(function () {
      outlinks.push($(this).attr('href') + ' L a/@href')
    })

    return outlinks
}

function serializeImages () {
  images = document.images

  for (var i = 0; i < images.length; i++) {
    var image = images[i]
    if (!(image.src)) { continue }

    var canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    var dataurl = canvas.toDataURL()
    var datastartpos = dataurl.match(',').index + 1
    var dd = dataurl.substring(datastartpos)
  }

  var imageDataSerialized = imageBase64Data.join('|||')
  var imageURIsSerialized = imageURIs.join('|||')
  localStorage['imagesInDOM'] = imageURIsSerialized
  return {uris: imageURIsSerialized, data: imageDataSerialized}
}

function serializeStyleSheets () {
  var cssFetchPromises = []
  var styleSheetURLs = []
  for (var ss = 0; ss < document.styleSheets.length; ss++) {
    styleSheetURLs.push(document.styleSheets[ss].href)
    var cssFetchPromise = fetch(document.styleSheets[ss].href)
    .then(function(resp) {
      return resp.text() 
    }).then(function(j) {
      return Promise.resolve(j)
    })
    cssFetchPromises.push(cssFetchPromise)
  }
    
    return Promise.all(cssFetchPromises)
}

function serializeJS () {
  var jsFetchPromises = []
  for (var scriptI = 0; scriptI < document.scripts.length; scriptI++) {
    //JSURLs.push(document.scripts[scriptI].src)
    console.log(document.scripts[scriptI].src)
    
    // Headers retrieved here are not complete like ones received from curl, hmm, maybe X-origin issue?
    console.log(document.scripts[scriptI].src)
    var jsFetchPromise = fetch(document.scripts[scriptI].src)
    .then(function(resp) {
      resp.headers.forEach(function(i,e) {
        console.log(e + ': ' + i)
      })
      return
      console.log(resp.headers.get('date'))

      return resp.text()
    }).then(function(j) {
      return Promise.resolve(j)
    })
  .catch(function(err) {
    console.log('err')
    console.log(err)
  }) 
    jsFetchPromises.push(jsFetchPromise)
  }
  
  return Promise.all(jsFetchPromises)
}

function getHTML () {
    // Append missing DOCTYPE
    var node = document.doctype
    var dtstr
    if (!node) {dtstr = '';}else {
      dtstr = '<!DOCTYPE '
        + '' + node.name
        + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
        + (!node.publicId && node.systemId ? ' SYSTEM' : '')
        + (node.systemId ? ' "' + node.systemId + '"' : '')
        + '>'
    }

    var domAsText = document.documentElement.outerHTML

    // This accounts for foo.txt documents on the web, which chrome puts a wrapper around
    var textDocumentStarterString = '<html><head></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">'
    if (domAsText.substr(0, textDocumentStarterString.length) == textDocumentStarterString) {
      console.log('Adjusting WARC algorithm to account for text rather than HTML document.')

      domAsText = $(document).find('pre').html() // Replace text w/ html wrapper with just text
      dtstr = '' // Remove the doctype injection
    }
    return domAsText
}

chrome.extension.onConnect.addListener(function (port) {
  port.onMessage.addListener(function (msg) {
    if (msg.method == 'getImageData') {
      return getImageData()
    } else if (msg.method == 'getHTML') {    
      Promise.all([serializeJS(), serializeStyleSheets()])
      .then(function(resp) {
        var jsFiles = resp[0]
        var cssFiles = resp[1]
        
        // Re-associate the URI with the fetched payload
        var js = {}
        for (var scriptI = 0; scriptI < document.scripts.length; scriptI++) {
          js[document.scripts[scriptI].src] = jsFiles[scriptI]
        }
        var css = {}
        for (var ss = 0; ss < document.styleSheets.length; ss++) {
          css[document.styleSheets[ss].href] = cssFiles[ss]
        }

        port.postMessage({
          'js': js,
          'css': css,
          'html': getHTML(),
          outlinks: generateOutlinks(),
        
          method: msg.method
        })
        
      })

   }
  })
})
/*
      port.postMessage({
        html: dtstr + domAsText, 
        uris: imageURIsSerialized,
        data: imageDataSerialized,
        cssuris: cssURIsSerialized,
        cssdata: cssDataSerialized,
        jsuris: jsURIsSerialized,
        jsdata: jsDataSerialized,
        outlinks: outlinksSerialized,
        method: msg.method
      })
      return


      var cssDataSerialized = styleSheetData.join('|||')
      var cssURIsSerialized = styleSheetURLs.join('|||')
      var jsDataSerialized = JSData.join('|||')
      var jsURIsSerialized = JSURLs.join('|||')
      var outlinksSerialized = outlinks.join('|||')


*/

// from https://developer.mozilla.org/en-US/docs/Web/API/window.btoa
function utf8_to_b64 (str) {
  return window.btoa(unescape(encodeURIComponent(str)))
}

function b64_to_utf8 (str) {
  return decodeURIComponent(escape(window.atob(str)))
}

function base64ArrayBuffer (arrayBuffer) {
  var base64 = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes = new Uint8Array(arrayBuffer)
  var byteLength = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63 // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}
