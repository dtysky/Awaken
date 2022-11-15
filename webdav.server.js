const webdav = require('webdav-server').v2;

// User manager (tells who are the users)
const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser('dtysky', '114514', false);

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, '/', [ 'all' ]);

const fileSystem = new webdav.PhysicalFileSystem('./test/server');

const server = new webdav.WebDAVServer({
  port: 8889,
  requireAuthentification: true,
  httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
  privilegeManager: privilegeManager,
  rootFileSystem: fileSystem
});

server.start((s) => {
  console.log('Server started on port ' + s.address().port + '.');
});
