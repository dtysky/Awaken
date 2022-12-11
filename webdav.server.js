const webdav = require('webdav-server').v2;
const fs = require('fs');

['./test/client/', './test/server/', './test/server/dav/'].forEach(p => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p)
  }
});

// User manager (tells who are the users)
const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser('dtysky', '114514', false);

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, '/', [ 'all' ]);

const fileSystem = new webdav.PhysicalFileSystem('./test/server/');

const server = new webdav.WebDAVServer({
  port: 8889,
  requireAuthentification: true,
  httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'Default realm'),
  privilegeManager: privilegeManager,
  rootFileSystem: fileSystem
});

server.afterRequest((arg, next) => {
  // Display the method, the URI, the returned status code and the returned message
  console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);
  next();
});

module.exports = server;
