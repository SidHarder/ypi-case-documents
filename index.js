var dotenv = require('dotenv').config();
var fs = require('fs');

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true })

var expressHandlebars = require('express-handlebars');
var engine = expressHandlebars.engine;

var path = require('path');

app.use('/documents', express.static(process.env.ACCESSION_DOCUMENTS_LOCATION));
app.use('/scanning', express.static(process.env.SCANNED_DOCUMENTS_LOCATION));
app.use('/pdf',savePdf);

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

function savePdf(req, res) {
  console.log('hello');
}

var isDirectory = directoryName => {
  return fs.lstatSync(directoryName).isDirectory()
}

var isFile = fileName => {
  return fs.lstatSync(fileName).isFile()
}

var isRequisition = fileName => {
  var regx = /.REQ/;
  return regx.test(fileName);
}

app.get('/scanfolders', (req, res) => {
  renderScanFolders(res);
});

function renderScanFolders (res) {
  var directories = fs.readdirSync(process.env.SCANNED_DOCUMENTS_LOCATION).map(directoryName => {
    return path.join(process.env.SCANNED_DOCUMENTS_LOCATION, directoryName)
  }).filter(isDirectory);

  var mappedDirectories = directories.map(function (dir) {
    var dirName = path.basename(dir);
    var url = `/scanfiles/${dirName}`;
    return { filePath: dir, displayName: dirName, url: url };
  });

  res.render('scanfolders', {
    directories: mappedDirectories
  });
}

app.get('/scanfiles/:folderName', (req, res) => {
  var data = {
    folderName: req.params.folderName,
    folderUrl: `/scanfolders`
  }
  
  renderScanFiles(data, res);
});

function renderScanFiles (data, res) {
  var files = fs.readdirSync(path.join(process.env.SCANNED_DOCUMENTS_LOCATION, data.folderName)).map(fileName => {
    return path.join(process.env.SCANNED_DOCUMENTS_LOCATION, data.folderName, fileName);
  }).filter(isFile);

  data.files = files.map(function (file) {
    var fileName = path.basename(file);
    var url = `/scanfiles/${data.folderName}/${fileName}`;
    return { filePath: file, displayName: fileName, url: url };
  })

  res.render('scanfiles', data);
}

app.get('/scanfiles/:folderName/:fileName', (req, res) => {
  var data = {
    folderName: req.params.folderName,
    fileName: req.params.fileName,
    url: `/scanning/${req.params.folderName}/${req.params.fileName}`
  }  
  res.render('scanfile', data);
});

app.post('/scanfiles/:folderName/:fileName/move', urlencodedParser , (req, res) => { 
  var data = {
    folderName: req.params.folderName,
    fileName: req.params.fileName,
    existingPath: path.join(process.env.SCANNED_DOCUMENTS_LOCATION, req.params.folderName, req.params.fileName),
    masterAccessionNo: req.body.masterAccessionNo,
    action: req.body.buttonSubmit
  }

  var newPath = getCasePath(data.masterAccessionNo);
  var maRegx = /^\d\d-\d+/g;

  if (maRegx.test(data.masterAccessionNo) == false) {
    renderInvalidMasterAccessionNo(data, res);
  } else {

    var requisitionfiles = fs.readdirSync(newPath).map(fileName => {
      return fileName;
    }).filter(isRequisition);

    var nextNumber = getNextRequisitionNo(requisitionfiles);
    var newFileName = path.join(newPath, `${data.masterAccessionNo}.REQ${nextNumber}.pdf`);
    
    fs.rename(data.existingPath, newFileName, function (err) {
      if (err) throw err
      data.url = `/scanfiles/${req.params.folderName}`;
      data.displayName = req.params.folderName;
      data.filePath = newPath;
      res.render('scanfile_moved', data);
    })
  }
});

function getNextRequisitionNo (files) {
  var existingNumbers = files.map(function (file) {
    var regx = /\.REQ(\d+)\./
    var match = file.match(regx);
    return match[1];
  }).sort(function (a, b) {
    return a - b;
  });

  var largestNumber = Math.max.apply(null, existingNumbers);
  return largestNumber + 1;
}

function renderInvalidMasterAccessionNo (data, res) {
  res.render('invalid_master_accession', {
    masterAccessionNo: data.masterAccessionNo,
    backUrl: `/scanfiles/${data.folderName}/${data.fileName}`,
  });
}

app.post('/scanfiles/:folderName/:fileName/back', urlencodedParser, (req, res) => {
  var data = {
    folderName: req.params.folderName,
    fileName: req.params.fileName    
  }
  renderScanFiles(data, res);
});

function getCasePath(masterAccessionNo) {
  var dashSplit = masterAccessionNo.split('-');
  var year = `20${dashSplit[0]}`;
  var number = Number(dashSplit[1]);

  var filePath = path.join(process.env.ACCESSION_DOCUMENTS_LOCATION, year, getBaseFolder(number), masterAccessionNo);

  console.log(`case document path: ${filePath}`)
  return filePath;
}

function isMasterAccessionValid(masterAccessionNo) {
  return masterAccessionNo.test(/^\d\d-\d+/g);
}

var getBaseFolder = (number) => {
  var lowerBound = 0;
  var upperBound = 0;

  for(var i=0; i<=number; i+=1000) {
    lowerBound = i;
    upperBound = i + 999;
  }

  if(lowerBound == 0) lowerBound = 1;
  return `${lowerBound.toString().padStart(5, 0)}-${upperBound.toString().padStart(5, 0)}`;
}

app.listen(process.env.APP_PORT, function (err) {
  if(err) return console.log(err);
  console.log(`Express listening on port: ${process.env.APP_PORT}`);
});