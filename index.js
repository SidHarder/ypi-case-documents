var fs = require('fs');

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true })

var expressHandlebars = require('express-handlebars');
var engine = expressHandlebars.engine;

var port = 50071;
var path = require('path');

app.use('/documents', express.static('/mnt/cfileserver/accessiondocuments'));
app.use('/scanning', express.static('/mnt/cfileserver/documents/scanning'));

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

var rootFolder = `/mnt/cfileserver/accessiondocuments`;

var isDirectory = directoryName => {
  return fs.lstatSync(directoryName).isDirectory()
}

var isFile = fileName => {
  return fs.lstatSync(fileName).isFile()
}

var directories = fs.readdirSync('/mnt/cfileserver/documents/scanning').map(directoryName => {
  return path.join('/mnt/cfileserver/documents/scanning', directoryName)
}).filter(isDirectory)

var mappedDirectories = directories.map(function (dir) {
  var displayName = dir.split('/')[5];
  var url = `/scanfiles/${displayName}`;
  return { filePath: dir, displayName: displayName, url: url };
})

app.get('/scanfolders', (req, res) => {
  res.render('scanfolders', {
    directories: mappedDirectories
  });
});

app.get('/scanfiles/:folderName', (req, res) => {
  var folderName = req.params.folderName;  

  var files = fs.readdirSync(`/mnt/cfileserver/documents/scanning/${folderName}`).map(fileName => {
    return path.join(`/mnt/cfileserver/documents/scanning/${folderName}`, fileName)
  }).filter(isFile)

  var mappedFiles = files.map(function (file) {
    var displayName = file.split('/')[6];
    var url = `/scanfiles/${folderName}/${displayName}`;
    return { filePath: file, displayName: displayName, url: url };
  })

  res.render('scanfiles', {
    folderName: folderName,
    files: mappedFiles
  });
});

app.get('/scanfiles/:folderName/:fileName', (req, res) => {
  var folderName = req.params.folderName;
  var fileName = req.params.fileName;
  var url = `http://10.1.2.90:50071/scanning/${folderName}/${fileName}`;  
  res.render('scanfile', {
    url: url,
    folderName: folderName,
    fileName: fileName
  });
});

app.post('/scanfiles/:folderName/:fileName/move', urlencodedParser , (req, res) => {    
  var filePath = getCasePath(req.body.masterAccessionNo);

  res.render('scanfile_moved', {
    fileName: req.params.fileName,
    url: `http://10.1.2.90:50071/scanfiles/${req.params.folderName}`,
    displayName: req.params.folderName,
    filePath: filePath
  });
});

function moveFile()

function getCasePath(masterAccessionNo) {
  var dashSplit = masterAccessionNo.split('-');
  var year = `20${dashSplit[0]}`;
  var number = Number(dashSplit[1]);

  var thousandNo = (Math.ceil(number / 1000) * 1000) - 1000;
  var filePath = path.join(rootFolder, year, `${thousandNo.toString().padStart(5, 0)}-${(thousandNo + 999).toString().padStart(5, 0)}`)

  return `${filePath}/${masterAccessionNo}.pdf`;
}


app.listen(port);