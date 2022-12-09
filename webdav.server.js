const webdav = require('webdav-server').v2;
const fs = require('fs');
const path = require('path');

const {HTTPRequestContext, Errors} = webdav;
HTTPRequestContext.create = (function (server, request, response, _rootPath, _callback) {
  var rootPath = _callback ? _rootPath : undefined;
  var callback = _callback ? _callback : _rootPath;
  var ctx = new HTTPRequestContext(server, request, response, null, rootPath);
  response.setHeader('DAV', '1,2');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', '*');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Expose-Headers', 'DAV, content-length, Allow, WWW-Authenticate');
  response.setHeader('MS-Author-Via', 'DAV');
  response.setHeader('Server', server.options.serverName + '/' + server.options.version);
  if (server.options.headers) {
      for (var headerName in server.options.headers)
          response.setHeader(headerName, server.options.headers[headerName]);
  }
  var setAllowHeader = function (type) {
      var allowedMethods = [];
      for (var name_3 in server.methods) {
          var method = server.methods[name_3];
          if (!method.isValidFor || method.isValidFor(ctx, type))
              allowedMethods.push(name_3.toUpperCase());
      }
      response.setHeader('Allow', allowedMethods.join(','));
      callback(null, ctx);
  };
  ctx.askForAuthentication(false, function (e) {
      if (e) {
          callback(e, ctx);
          return;
      }
      server.httpAuthentication.getUser(ctx, function (e, user) {
          ctx.user = user;
          if (e !== Errors.MissingAuthorisationHeader || ctx.request.method !== 'OPTIONS') {
              if (e && e !== Errors.UserNotFound) {
                  if (server.options.requireAuthentification || e !== Errors.MissingAuthorisationHeader)
                      return callback(e, ctx);
              }
              if (server.options.requireAuthentification && (!user || user.isDefaultUser || e === Errors.UserNotFound))
                  return callback(Errors.MissingAuthorisationHeader, ctx);
          }
          server.getFileSystem(ctx.requested.path, function (fs, _, subPath) {
              fs.type(ctx.requested.path.isRoot() ? server.createExternalContext() : ctx, subPath, function (e, type) {
                  if (e)
                      type = undefined;
                  setAllowHeader(type);
              });
          });
      });
  });
}).bind(webdav.HTTPRequestContext);

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

server.start((s) => {
  console.log('Server started on port ' + s.address().port + '.');
});
