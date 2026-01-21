const test = require('tape');
const proxyquire = require('proxyquire');
const path = require('path');

const pathToObjectUnderTest = '../';
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

function getBaseMocks() {
    return {
        'graceful-fs': {
            stat: (fileName, callback) => {
                callback(null, {
                    isFile: function() {
                        return true;
                    },
                    mtime: new Date(),
                });
            },
            createReadStream: () => ({ on: () => {} }),
        },
        hashr: { hash: value => value },
        'stream-catcher': function() {
            this.read = () => {};
            this.write = () => {};
            this.del = () => {};
            this.clear = () => {};
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

test('⚡ Bolt: serveDirectory creates only one watcher for the directory', t => {
    t.plan(1);

    const mocks = getBaseMocks();
    let watchCount = 0;
    mocks.chokidar.watch = () => {
        watchCount++;
        return {
            on: () => {},
            close: () => Promise.resolve(),
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    const serve = fileServer.serveDirectory(testRootDirectory, { '.txt': 'text/plain' });

    serve(testRequest, testResponse, 'file1.txt');
    serve(testRequest, testResponse, 'file2.txt');

    t.equal(watchCount, 1, 'only one watcher was created for the directory');
});

test('⚡ Bolt: serveDirectory watcher invalidates cache on file change', t => {
    t.plan(2);

    const mocks = getBaseMocks();
    let changeCallback;
    const changedPath = path.join(testRootDirectory, 'file1.txt');

    mocks.chokidar.watch = () => {
        return {
            on: (event, callback) => {
                if (event === 'change') {
                    changeCallback = callback;
                }
            },
            close: () => Promise.resolve(),
        };
    };

    const cacheDeletions = [];
    mocks['stream-catcher'] = function() {
        this.read = () => {};
        this.write = () => {};
        this.del = (path) => {
            cacheDeletions.push(path);
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    fileServer.serveDirectory(testRootDirectory, { '.txt': 'text/plain' });

    changeCallback(changedPath);

    t.ok(cacheDeletions.includes(changedPath), 'original file was deleted from cache');
    t.ok(cacheDeletions.includes(`${changedPath}.gz`), 'gzipped file was deleted from cache');
});

test('⚡ Bolt: serveDirectory watcher invalidates cache on file unlink', t => {
    t.plan(2);

    const mocks = getBaseMocks();
    let unlinkCallback;
    const unlinkedPath = path.join(testRootDirectory, 'file1.txt');

    mocks.chokidar.watch = () => {
        return {
            on: (event, callback) => {
                if (event === 'unlink') {
                    unlinkCallback = callback;
                }
            },
            close: () => Promise.resolve(),
        };
    };

    const cacheDeletions = [];
    mocks['stream-catcher'] = function() {
        this.read = () => {};
        this.write = () => {};
        this.del = (path) => {
            cacheDeletions.push(path);
        };
    };

    const MockFileServer = proxyquire(pathToObjectUnderTest, mocks);
    const fileServer = new MockFileServer(() => {});

    fileServer.serveDirectory(testRootDirectory, { '.txt': 'text/plain' });

    unlinkCallback(unlinkedPath);

    t.ok(cacheDeletions.includes(unlinkedPath), 'original file was deleted from cache');
    t.ok(cacheDeletions.includes(`${unlinkedPath}.gz`), 'gzipped file was deleted from cache');
});
