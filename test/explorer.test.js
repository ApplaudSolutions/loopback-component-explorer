// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-component-explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var loopback = require('loopback');
var explorer = require('../');
var request = require('supertest');
var assert = require('assert');
var path = require('path');
var expect = require('chai').expect;
var urlJoin = require('../lib/url-join');
var os = require('os');

describe('explorer', function() {
  describe('with default config', function() {
    beforeEach(givenLoopBackAppWithExplorer());

    it('should register "loopback-component-explorer" to the app', function() {
      expect(this.app.get('loopback-component-explorer'))
      .to.have.property('mountPath', '/explorer');
    });

    it('should redirect to /explorer/', function(done) {
      request(this.app)
        .get('/explorer')
        .expect(301)
        .end(done);
    });

    it('should serve the explorer at /explorer/', function(done) {
      request(this.app)
        .get('/explorer/')
        .expect('Content-Type', /html/)
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;

          assert(!!~res.text.indexOf('<title>LoopBack API Explorer</title>'),
            'text does not contain expected string');

          done();
        });
    });

    it('should serve correct swagger-ui config', function(done) {
      request(this.app)
        .get('/explorer/config.json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          expect(res.body).to
            .have.property('url', '/explorer/swagger.json');

          done();
        });
    });
  });

  describe('with custom explorer base', function() {
    beforeEach(givenLoopBackAppWithExplorer('/swagger'));

    it('should register "loopback-component-explorer" to the app', function() {
      expect(this.app.get('loopback-component-explorer'))
      .to.have.property('mountPath', '/swagger');
    });

    it('should serve correct swagger-ui config', function(done) {
      request(this.app)
        .get('/swagger/config.json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          expect(res.body).to
            .have.property('url', '/swagger/swagger.json');

          done();
        });
    });
  });

  describe('with custom app.restApiRoot', function() {
    it('should serve correct swagger-ui config', function(done) {
      var app = loopback();
      app.set('restApiRoot', '/rest-api-root');
      app.set('remoting', { cors: false });
      configureRestApiAndExplorer(app);

      request(app)
        .get('/explorer/config.json')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          expect(res.body).to
            .have.property('url', '/explorer/swagger.json');

          done();
        });
    });

    it('removes trailing slash from baseUrl', function(done) {
      // SwaggerUI builds resource URL by concatenating basePath + resourcePath
      // Since the resource paths are always startign with a slash,
      // if the basePath ends with a slash too, an incorrect URL is produced
      var app = loopback();
      app.set('restApiRoot', '/apis/');
      app.set('remoting', { cors: false });
      configureRestApiAndExplorer(app);

      request(app)
        .get('/explorer/swagger.json')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          var baseUrl = res.body.basePath;
          var apiPath = Object.keys(res.body.paths)[0];
          expect(baseUrl + apiPath).to.equal('/apis/products');

          done();
        });
    });
  });

  describe('with custom front-end files', function() {
    var app;
    beforeEach(function setupExplorerWithUiDirs() {
      app = loopback();
      app.set('remoting', { cors: false });
      explorer(app, {
        uiDirs: [path.resolve(__dirname, 'fixtures', 'dummy-swagger-ui')],
      });
    });

    it('overrides swagger-ui files', function(done) {
      request(app).get('/explorer/swagger-ui.js')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          // expect the content of `dummy-swagger-ui/swagger-ui.js`
          expect(res.text).to.contain('/* custom swagger-ui file */');

          done();
        });
    });

    it('overrides strongloop overrides', function(done) {
      request(app).get('/explorer/')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(er);
          // expect the content of `dummy-swagger-ui/index.html`
          expect(res.text).to.contain('custom index.html');
          done();
        });
    });
  });

  describe('with swaggerUI option', function() {
    var app;
    beforeEach(function setupExplorerWithoutUI() {
      app = loopback();
      app.set('remoting', { cors: false });
      explorer(app, {
        swaggerUI: false,
      });
    });

    it('overrides swagger-ui files', function(done) {
      request(app).get('/explorer/swagger-ui.js')
        .expect(404, done);
    });

    it('should serve config.json', function(done) {
      request(app)
        .get('/explorer/config.json')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          expect(res.body).to
            .have.property('url', '/explorer/swagger.json');

          done();
        });
    });

    it('should serve swagger.json', function(done) {
      request(app)
        .get('/explorer/swagger.json')
        .expect(200, done);
    });
  });

  describe('explorer.routes API', function() {
    var app;
    beforeEach(function() {
      app = loopback();
      app.set('remoting', { cors: false });
      var Product = loopback.PersistedModel.extend('product');
      Product.attachTo(loopback.memory());
      app.model(Product);
    });

    it('creates explorer routes', function(done) {
      app.use('/explorer', explorer.routes(app));
      app.use(app.get('restApiRoot') || '/', loopback.rest());

      request(app)
        .get('/explorer/config.json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });
  });

  describe('when specifying custom static file root directories', function() {
    var app;
    beforeEach(function() {
      app = loopback();
      app.set('remoting', { cors: false });
    });

    it('should allow `uiDirs` to be defined as an Array', function(done) {
      explorer(app, {
        uiDirs: [path.resolve(__dirname, 'fixtures', 'dummy-swagger-ui')],
      });

      request(app).get('/explorer/')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          // expect the content of `dummy-swagger-ui/index.html`
          expect(res.text).to.contain('custom index.html');
          done();
        });
    });

    it('should allow `uiDirs` to be defined as an String', function(done) {
      explorer(app, {
        uiDirs: path.resolve(__dirname, 'fixtures', 'dummy-swagger-ui'),
      });

      request(app).get('/explorer/')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          // expect the content of `dummy-swagger-ui/index.html`
          expect(res.text).to.contain('custom index.html');
          done();
        });
    });
  });

  describe('Cross-origin resource sharing', function() {
    it('allows cross-origin requests by default', function(done) {
      var app = loopback();
      process.once('deprecation', function() { /* ignore */ });
      configureRestApiAndExplorer(app, '/explorer');

      request(app)
        .options('/explorer/swagger.json')
        .set('Origin', 'http://example.com/')
        .expect('Access-Control-Allow-Origin', /^http:\/\/example.com\/|\*/)
        .expect('Access-Control-Allow-Methods', /\bGET\b/)
        .end(done);
    });

    it('can be disabled by configuration', function(done) {
      var app = loopback();
      app.set('remoting', { cors: false });
      configureRestApiAndExplorer(app, '/explorer');

      request(app)
        .options('/explorer/swagger.json')
        .end(function(err, res) {
          if (err) return done(err);

          var allowOrigin = res.get('Access-Control-Allow-Origin');
          expect(allowOrigin, 'Access-Control-Allow-Origin')
            .to.equal(undefined);

          done();
        });
    });
  });

  it('updates swagger object when a new model is added', function(done) {
    var app = loopback();
    app.set('remoting', { cors: false });
    configureRestApiAndExplorer(app, '/explorer');

    // Ensure the swagger object was built
    request(app)
      .get('/explorer/swagger.json')
      .expect(200)
      .end(function(err) {
        if (err) return done(err);

        // Create a new model
        var Model = loopback.PersistedModel.extend('Customer');
        Model.attachTo(loopback.memory());
        app.model(Model);

        // Request swagger.json again
        request(app)
          .get('/explorer/swagger.json')
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            var modelNames = Object.keys(res.body.definitions);
            expect(modelNames).to.contain('Customer');
            var paths = Object.keys(res.body.paths);
            expect(paths).to.have.contain('/Customers');

            done();
          });
      });
  });

  it('updates swagger object when a remote method is disabled', function(done) {
    var app = loopback();
    app.set('remoting', { cors: false });
    configureRestApiAndExplorer(app, '/explorer');

    // Ensure the swagger object was built
    request(app)
      .get('/explorer/swagger.json')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);

        // Check the method that will be disabled
        var paths = Object.keys(res.body.paths);
        expect(paths).to.contain('/products/findOne');

        var Product = app.models.Product;
        Product.disableRemoteMethodByName('findOne');

        // Request swagger.json again
        request(app)
          .get('/explorer/swagger.json')
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            var paths = Object.keys(res.body.paths);
            expect(paths).to.not.contain('/products/findOne');

            done();
          });
      });
  });

  function givenLoopBackAppWithExplorer(explorerBase) {
    return function(done) {
      var app = this.app = loopback();
      app.set('remoting', { cors: false });
      configureRestApiAndExplorer(app, explorerBase);

      done();
    };
  }

  function configureRestApiAndExplorer(app, explorerBase) {
    var Product = loopback.PersistedModel.extend('product');
    Product.attachTo(loopback.memory());
    app.model(Product);

    explorer(app, { mountPath: explorerBase });
    app.set('legacyExplorer', false);
    app.use(app.get('restApiRoot') || '/', loopback.rest());
  }
});
