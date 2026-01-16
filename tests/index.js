const test = require('tape');
const proxyquire = require('proxyquire');
const path = require('path');

const pathToObjectUnderTest = '../';
const FileServer = require(pathToObjectUnderTest);
const testDate = new Date();
const testFileName = './foo.txt';
const testMimeType = 'bar';
const testMaxAge = 123;
const testKey = 'bar';
const testRootDirectory = './files';
const testRequest = {
    url: "/bar/foo.txt",
    headers: {
        'accept-encoding': 'foo gzip bar',
    },
};
const testResponse = {
    setHeader: () => {},
    removeHeader: () => {},
    on: () => {},
};
const testError = {
    code: 404,
    message: `404: Not Found ${testFileName}`,
};

function createErrorCallback(t, expectedError = testError, expectedResponse = testResponse) {
    return function errorCallback(error, request, response) {
        t.deepEqual(error, expectedError, 'got correct error');
        t.equal(request, testRequest, 'got correct request');
        t.equal(response, expectedResponse, 'got correct response');
    };
}

function getBaseMocks() {
    return {
        'graceful-fs': {
            stat: (fileName, callback) => {
                callback(~fileName.indexOf('.gz'), {
                    isFile: function() {
                        return true;
                    },
                    mtime: testDate,
                });
            },
        },
        hashr: { hash: value => value },
        'stream-catcher': function() {
            this.read = () => {};
            this.write = () => {};
        },
        chokidar: {
            watch: function() {
                return {
                    on: () => {},
                    close: () => Promise.resolve(),
                };
            },
        },
    };
}

test('FileServer is a function', t => {
    t.plan(1);

    t.equal(typeof FileServer, 'function', 'FileServer is a function');
});

test('FileServer requires a callback', t => {
    t.plan(1);

    t.throws(() => {
        new FileServer();
    }, 'FileServer throws if no callback');
});

test('FileServer constructs a cache', t => {
    t.plan(4);

    const expectedMax = 1024 * 1000;

    const lengthTest = {
        length: 'foo',
    };

    const testCache = {};

    const mocks = getBaseMocks();

    mocks['stream-catcher'] = function(options) {
        t.equal(options.max, expectedMax, 'cache max set correctly');
        t.equal(typeof options.length, 'function', 'length is a function');
        t.equal(options.length(lengthTest), 'foo', 'length function gets length property');
        return testCache;
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.equal(fileServer.cache, testCache, 'cache was set');
});

test('FileServer constructs a cache with custom size', t => {
    t.plan(1);

    const expectedMax = 123;
    const mocks = getBaseMocks();

    mocks['stream-catcher'] = function(options) {
        t.equal(options.max, expectedMax, 'cache max set correctly');
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    new MockFileServer(() => {}, expectedMax);
});

test('FileServer sets and flips the error callback', t => {
    t.plan(3);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer((error, request, response) => {
        t.equal(error, 3, 'error is correct');
        t.equal(request, 1, 'request is correct');
        t.equal(response, 2, 'response is correct');
    });

    fileServer.errorCallback(1, 2, 3);
});

test('serveFile is a function', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.equal(typeof fileServer.serveFile, 'function', 'serveFile is a function');
});

test('serveFile requires a fileName', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.throws(() => {
        fileServer.serveFile();
    }, 'serveFile throws if no fileName');
});

test('serveFile returns a function', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.equal(typeof fileServer.serveFile('./foo'), 'function', 'serveFile returns a function');
});

test('serveFile returns full error on generic stats error', t => {
    t.plan(3);

    const mocks = getBaseMocks();

    mocks['graceful-fs'].stat = (fileName, callback) => callback(testError);

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t));

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile 404s on file stat ENOENT error', t => {
    t.plan(3);

    const mocks = getBaseMocks();

    mocks['graceful-fs'].stat = (fileName, callback) => callback({ message: 'ENOENT' });

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t));

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile 404s on not isFile', t => {
    t.plan(3);

    const mocks = getBaseMocks();

    mocks['graceful-fs'].stat = (fileName, callback) => {
        callback(~fileName.indexOf('.gz'), {
            isFile: function() {
                return false;
            },
        });
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t));

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile sets headers and asks for file', t => {
    t.plan(10);

    const mocks = getBaseMocks();
    const testResponse = {
        setHeader: (key, value) => {
            if (key === 'ETag') {
                t.equal(value, testFileName + testDate.getTime(), `got correct header value for ${key}`);
                return;
            }

            if (key === 'Cache-Control') {
                t.equal(value, `private, max-age=${testMaxAge}`, `got correct header value for ${key}`);
                return;
            }

            if (key === 'Content-Type') {
                t.equal(value, testMimeType, `got correct header value for ${key}`);
                return;
            }

            t.fail(`Set unexpected header key: ${key} value: ${value}`);
        },
        on: (eventName, callback) => {
            t.equal(eventName, 'error', 'set error handeler');
            callback(testError);
        },
    };

    mocks['stream-catcher'] = function() {
        this.write = function(fileName, response, createReadStream) {
            t.equal(fileName, testFileName, 'fileName is correct');
            t.equal(response, testResponse, 'response is correct');
            t.equal(typeof createReadStream, 'function', 'createReadStream is a function');
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t, undefined, testResponse));

    const serveFile = fileServer.serveFile(testFileName, testMimeType, testMaxAge);

    serveFile(testRequest, testResponse);
});

test('serveFile returns 304 if etag matches', t => {
    t.plan(4);

    const mocks = getBaseMocks();
    const testRequest = {
        headers: {
            'if-none-match': testFileName + testDate.getTime(),
        },
    };
    const testResponse = {
        setHeader: (key, value) => {
            if (key === 'ETag') {
                t.equal(value, testFileName + testDate.getTime(), `got correct header value for ${key}`);
                return;
            }

            if (key === 'Cache-Control') {
                t.equal(value, 'private, max-age=0', `got correct header value for ${key}`);
                return;
            }

            t.fail(`Set unexpected header key: ${key} value: ${value}`);
        },
        writeHead: code => t.equal(code, 304, 'set 304 code correctly'),
        end: () => t.pass('end was called'),
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile passes create stream into cache', t => {
    t.plan(10);

    const mocks = getBaseMocks();
    const testReadStream = {
        on: function(eventName, callback) {
            t.equal(eventName, 'error', 'set error handeler');
            callback(testError);
        },
    };

    mocks['graceful-fs'] = {
        stat: function(fileName, callback) {
            callback(~fileName.indexOf('.gz'), {
                isFile: function() {
                    return true;
                },
                mtime: testDate,
            });
        },
        createReadStream: function(key) {
            t.equal(key, testKey, 'key is correct');
            return testReadStream;
        },
    };

    mocks['stream-catcher'] = function() {
        this.write = function(fileName, response, createReadStream) {
            t.equal(fileName, testFileName, 'fileName is correct');
            t.equal(response, testResponse, 'response is correct');
            t.equal(typeof createReadStream, 'function', 'createReadStream is a function');

            createReadStream(testKey);
        };

        this.read = function(key, readStream) {
            t.equal(key, testKey, 'key is correct');
            t.equal(readStream, testReadStream, 'readStream is correct');
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t));

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile watcher invalidates cache on change and unlink', t => {
    t.plan(8);

    let changeCallback;
    let unlinkCallback;
    const mocks = getBaseMocks();
    const watcherMock = {
        on: function(event, callback) {
            if (event === 'change') {
                changeCallback = callback;
            }
            if (event === 'unlink') {
                unlinkCallback = callback;
            }
        },
        close: () => new Promise(resolve => resolve()),
    };

    mocks.chokidar.watch = () => watcherMock;

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});
    fileServer.serveFile(testFileName);

    t.equal(Object.keys(fileServer.watchers).length, 1, 'watcher was created');

    // Test change event
    let delCount = 0;
    fileServer.cache.del = (fileName) => {
        delCount++;
        if (delCount === 1) {
            t.equal(fileName, testFileName, 'deleted correct fileName on change');
        } else {
            t.equal(fileName, `${testFileName}.gz`, 'deleted correct .gz fileName on change');
        }
    };
    changeCallback();
    t.equal(delCount, 2, 'cache.del was called twice for change');

    // Test unlink event
    delCount = 0;
    fileServer.cache.del = (fileName) => {
        delCount++;
        if (delCount === 1) {
            t.equal(fileName, testFileName, 'deleted correct fileName on unlink');
        } else {
            t.equal(fileName, `${testFileName}.gz`, 'deleted correct .gz fileName on unlink');
        }
    };
    unlinkCallback();
    t.equal(delCount, 2, 'cache.del was called twice for unlink');
    t.equal(Object.keys(fileServer.watchers).length, 0, 'watcher was removed after unlink');
});

test('serveFile checks for .gz file if gzip supported but uses original if not available', t => {
    t.plan(3);

    const mocks = getBaseMocks();

    mocks['graceful-fs'] = {
        stat: (fileName, callback) => {
            callback(~fileName.indexOf('.gz'), {
                isFile: function() {
                    return true;
                },
                mtime: testDate,
            });
        },
        createReadStream: () => {},
    };

    mocks['stream-catcher'] = function() {
        this.write = function(fileName, response, createReadStream) {
            t.equal(fileName, testFileName, 'fileName is correct');
            t.equal(response, testResponse, 'response is correct');
            t.equal(typeof createReadStream, 'function', 'createReadStream is a function');
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveFile uses .gz file if gzip supported and exists', t => {
    t.plan(3);

    const mocks = getBaseMocks();

    mocks['graceful-fs'] = {
        stat: function(fileName, callback) {
            callback(!~fileName.indexOf('.gz'), {
                isFile: function() {
                    return true;
                },
                mtime: testDate,
            });
        },
        createReadStream: () => {},
    };

    mocks['stream-catcher'] = function() {
        this.write = function(fileName, response, createReadStream) {
            t.equal(fileName, `${testFileName}.gz`, 'fileName is correct');
            t.equal(response, testResponse, 'response is correct');
            t.equal(typeof createReadStream, 'function', 'createReadStream is a function');
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    const serveFile = fileServer.serveFile(testFileName);

    serveFile(testRequest, testResponse);
});

test('serveDirectory is a function', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.equal(typeof fileServer.serveDirectory, 'function', 'serveDirectory is a function');
});

test('serveDirectory requires a rootDirectory', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.throws(() => {
        fileServer.serveDirectory();
    }, 'serveDirectory throws if no rootDirectory');
});

test('serveDirectory requires a mimeTypes object', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.throws(() => {
        fileServer.serveDirectory('./files');
    }, 'serveDirectory throws if no mimeTypes');
});

test('serveDirectory mimeTypes must start with a .', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.throws(() => {
        fileServer.serveDirectory(
            './files',
            {
                '.foo': 'bar',
                meh: 'stuff',
            },
            123,
        );
    }, 'serveDirectory throws if no mimeTypes');
});

test('serveDirectory returns a function', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    t.equal(typeof fileServer.serveDirectory('./files', {}), 'function', 'serveDirectory returns a function');
});

test('serveDirectory 404s if mimetype mismatch', t => {
    t.plan(3);

    const testFile = './foo.bar';
    const expectedError = { code: 404, message: `404: Not Found ${path.join(testRootDirectory, testFile)}` };

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t, expectedError));

    const serveDirectory = fileServer.serveDirectory(testRootDirectory, {
        '.txt': 'text/plain',
    });

    serveDirectory(testRequest, testResponse, testFile);
});

test('serveDirectory 404s if try to navigate up a level', t => {
    t.plan(3);

    const testFile = '../../foo.txt';
    const expectedError = { code: 404, message: `404: Not Found ${testFile}` };

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(createErrorCallback(t, expectedError));

    const serveDirectory = fileServer.serveDirectory(testRootDirectory, {
        '.txt': 'text/plain',
    });

    serveDirectory(testRequest, testResponse, testFile);
});

test('serveDirectory creates a single watcher and invalidates cache', t => {
    t.plan(8);

    let changeCallback;
    let unlinkCallback;
    const mocks = getBaseMocks();
    const watcherMock = {
        on: function(event, callback) {
            if (event === 'change') {
                changeCallback = callback;
            }
            if (event === 'unlink') {
                unlinkCallback = callback;
            }
        },
        close: () => new Promise(resolve => resolve()),
    };
    let watchCount = 0;
    mocks.chokidar.watch = () => {
        watchCount++;
        return watcherMock;
    };
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    const serveDirectory = fileServer.serveDirectory(testRootDirectory, { '.txt': 'text/plain' });
    serveDirectory(testRequest, testResponse, 'foo.txt');
    serveDirectory(testRequest, testResponse, 'bar.txt');

    t.equal(watchCount, 1, 'only one watcher was created for the directory');
    t.equal(Object.keys(fileServer.watchers).length, 1, 'watcher was stored');

    // Test change event
    let changeDelCount = 0;
    fileServer.cache.del = (filePath) => {
        changeDelCount++;
        if (changeDelCount === 1) {
            t.equal(filePath, 'changed.txt', 'deleted correct file on change');
        } else {
            t.equal(filePath, 'changed.txt.gz', 'deleted correct .gz file on change');
        }
    };
    changeCallback('changed.txt');
    t.equal(changeDelCount, 2, 'cache.del was called twice for change');

    // Test unlink event
    let delCount = 0;
    fileServer.cache.del = (filePath) => {
        delCount++;
        if (delCount === 1) {
            t.equal(filePath, 'unlinked.txt', 'deleted correct file on unlink');
        } else {
            t.equal(filePath, 'unlinked.txt.gz', 'deleted correct .gz file on unlink');
        }
    };
    unlinkCallback('unlinked.txt');
    t.equal(delCount, 2, 'cache.del was called twice for unlink');
});

test('serveDirectory calls serveFile', t => {
    t.plan(6);

    const testFile = './bar/foo.txt';

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    const serveDirectory = fileServer.serveDirectory(
        testRootDirectory,
        {
            '.txt': 'text/majigger',
        },
        testMaxAge,
    );

    fileServer.serveFile = function(fileName, mimeType, maxAge, _suppressWatcher) {
        t.equal(fileName, path.join(testRootDirectory, testFile), 'fileName is correct');
        t.equal(mimeType, 'text/majigger', 'mimeType is correct');
        t.equal(maxAge, testMaxAge, 'maxAge is correct');
        t.equal(_suppressWatcher, true, '_suppressWatcher is true');

        return function(request, response) {
            t.equal(request, testRequest, 'request is correct');
            t.equal(response, testResponse, 'response is correct');
        };
    };

    serveDirectory(testRequest, testResponse, testFile);
});

test('serveDirectory calls serveFile with filename retrieved from url', t => {
    t.plan(5);

    const testFile = './bar/foo.txt';

    const mocks = getBaseMocks();
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    const serveDirectory = fileServer.serveDirectory(
        testRootDirectory,
        {
            '.txt': 'text/majigger',
        },
        testMaxAge,
    );

    fileServer.serveFile = function(fileName, mimeType, maxAge) {
        t.equal(fileName, path.join(testRootDirectory, testFile), 'fileName is correct');
        t.equal(mimeType, 'text/majigger', 'mimeType is correct');
        t.equal(maxAge, testMaxAge, 'maxAge is correct');

        return function(request, response) {
            t.equal(request, testRequest, 'request is correct');
            t.equal(response, testResponse, 'response is correct');
        };
    };

    serveDirectory(testRequest, testResponse);
});

test('close terminates all file watchers', t => {
    t.plan(3);

    let closedConnections = 0;
    const mocks = getBaseMocks();
    mocks.chokidar.watch = () => ({
        on: () => {},
        close: () => {
            closedConnections++;
            return Promise.resolve();
        },
    });
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    // Create a directory watcher and a file watcher
    const serveDirectory = fileServer.serveDirectory(testRootDirectory, { '.txt': 'text/plain' });
    const serveFile = fileServer.serveFile(testFileName);
    serveDirectory(testRequest, testResponse, 'foo.txt');
    serveFile(testRequest, testResponse);

    t.equal(Object.keys(fileServer.watchers).length, 2, 'two watchers were created');

    fileServer.close(() => {
        t.equal(closedConnections, 2, 'both watchers were closed');
        t.equal(Object.keys(fileServer.watchers).length, 0, 'watchers were removed');
    });
});