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

test('serveFile watches files only once with chokidar and handles change/unlink', t => {
    t.plan(7);

    const mocks = getBaseMocks();
    const expectedOptions = { persistent: true, ignoreInitial: true };
    let watchCallCount = 0;
    let changeCallback;
    let unlinkCallback;

    mocks.chokidar.watch = (fileName, options) => {
        watchCallCount++;
        t.equal(fileName, testFileName, 'got correct fileName');
        t.deepEqual(options, expectedOptions, 'got correct options');

        return {
            on: function(event, callback) {
                if (event === 'change') {
                    t.pass('registered change event');
                    changeCallback = callback;
                } else if (event === 'unlink') {
                    t.pass('registered unlink event');
                    unlinkCallback = callback;
                }
            },
        };
    };

    const deletedFiles = [];
    mocks['stream-catcher'] = function() {
        this.del = fileName => deletedFiles.push(fileName);
        this.read = () => {}; // from base mock
        this.write = () => {}; // from base mock
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    // Call it twice to ensure watcher is only created once
    fileServer.serveFile(testFileName);
    fileServer.serveFile(testFileName);

    t.equal(watchCallCount, 1, 'chokidar.watch called only once');

    // Trigger change
    changeCallback();
    t.deepEqual(deletedFiles.sort(), [testFileName, `${testFileName}.gz`].sort(), 'deleted correct files from cache on change');

    // Trigger unlink
    deletedFiles.length = 0;
    unlinkCallback();
    t.deepEqual(deletedFiles.sort(), [testFileName, `${testFileName}.gz`].sort(), 'deleted correct files from cache on unlink');
});

test('serveDirectory watches directories only once with chokidar', t => {
    t.plan(9);

    const mocks = getBaseMocks();
    const expectedOptions = { persistent: true, ignoreInitial: true };
    const testFile1 = 'foo.txt';
    const testFile2 = 'bar.txt';
    const deletedFiles = [];
    let watchCallCount = 0;
    let changeCallback;
    let unlinkCallback;

    mocks.chokidar.watch = (fileName, options) => {
        watchCallCount++;
        t.equal(fileName, testRootDirectory, 'got correct directory to watch');
        t.deepEqual(options, expectedOptions, 'got correct options');

        return {
            on: function(event, callback) {
                if (event === 'change') {
                    t.pass('registered change event');
                    changeCallback = callback;
                } else if (event === 'unlink') {
                    t.pass('registered unlink event');
                    unlinkCallback = callback;
                }
            },
        };
    };

    mocks['stream-catcher'] = function() {
        this.del = fileName => deletedFiles.push(fileName);
        this.read = () => {};
        this.write = () => {};
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(createErrorCallback(t, testError, testResponse));

    let serveFileCallCount = 0;
    fileServer.serveFile = function(fileName, mimeType, maxAge, _suppressWatcher) {
        serveFileCallCount++;
        t.ok(_suppressWatcher, `serveFile called with _suppressWatcher=true for file ${serveFileCallCount}`);
        // Must return a function, as the original does.
        return function(request, response) {};
    };

    const serveDirectory = fileServer.serveDirectory(
        testRootDirectory, {
            '.txt': 'text/plain',
        }
    );

    // Serve two different files from the same directory
    serveDirectory(testRequest, testResponse, testFile1);
    serveDirectory(testRequest, testResponse, testFile2);

    t.equal(watchCallCount, 1, 'chokidar.watch called only once for directory');

    // Trigger change event
    const changedFilePath = path.join(testRootDirectory, 'changed.txt');
    changeCallback(changedFilePath);
    t.deepEqual(deletedFiles.sort(), [changedFilePath, `${changedFilePath}.gz`].sort(), 'deleted correct files from cache on change');

    // Reset and trigger unlink event
    deletedFiles.length = 0;
    const unlinkedFilePath = path.join(testRootDirectory, 'unlinked.txt');
    unlinkCallback(unlinkedFilePath);
    t.deepEqual(deletedFiles.sort(), [unlinkedFilePath, `${unlinkedFilePath}.gz`].sort(), 'deleted correct files from cache on unlink');
});

test('process on exit cleans up watches', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    const oldProcessOn = process.on;

    let MockFileServer;

    mocks.chokidar.watch = () => ({
        on: (event, callback) => callback(),
        close: () => t.pass('closed watcher'),
    });

    mocks['stream-catcher'] = function() {
        this.del = () => {};
    };

    process.on = function(event, callback) {
        setTimeout(() => {
            const fileServer = new MockFileServer(() => {});

            fileServer.serveFile(testFileName);

            callback();

            oldProcessOn.call(process, event, callback);
        }, 0);

        process.on = oldProcessOn;
    };

    MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
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

test('serveDirectory calls serveFile', t => {
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
    mocks.chokidar.watch = () => {
        return {
            on: () => {},
            close: () => {
                closedConnections++;
                Promise.resolve();
            },
        };
    };
    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);

    const fileServer = new MockFileServer(() => {});

    // Observe 2 files via each method
    const serveDirectory = fileServer.serveDirectory(
        testRootDirectory,
        {
            '.txt': 'text/majigger',
        },
        testMaxAge,
    );

    const serveFile = fileServer.serveFile(testFileName);

    // Watchers start on first request
    serveDirectory(testRequest, testResponse);
    serveFile(testRequest, testResponse);

    t.equal(Object.keys(fileServer.watchers).length, 2);

    fileServer.close(() => {
        t.equal(closedConnections, 2);
        t.equal(Object.keys(fileServer.watchers).length, 0);
    });

});