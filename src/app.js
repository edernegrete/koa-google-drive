
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const Koa = require('koa');
const logger = require('koa-logger');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const fs = require('fs');

const uploadFile = require('./google-auth.js');

const app = new Koa();

app.use(bodyParser());


// Custom 401 handling
app.use(async (ctx, next) => next().catch((err) => {
  if (err.status === 401) {
    ctx.status = 401;
    const errMessage = err.originalError ?
      err.originalError.message :
      err.message;
    ctx.body = {
      error: errMessage,
    };
    ctx.set('X-Status-Reason', errMessage);
  } else {
    throw err;
  }
}));

// Logger
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

if (process.env.NODE_ENV !== 'test') {
  app.use(logger());
}

const writeJSONFile = (ctx, fileName) => new Promise(
  (resolve, reject) => {
    try {
      const createStream = fs.createWriteStream(`./files/${fileName}.json`);
      const writeStream = fs.createWriteStream(`./files/${fileName}.json`);
      writeStream.write(JSON.stringify(ctx.request.body));
      createStream.end();
      writeStream.end();
      resolve();
    } catch (err)
      {
        reject(err);
      }
});

const removeFile = fileName => new Promise((resolve, reject) => {
  fs.unlink(`./files/${fileName}.json`, (err) => {
    if (err) {
      reject(err);
      throw err;
    }
    resolve();
    console.log('filePath was deleted');
  });
});

router.post('/create', async (ctx, next) => {
  if (!ctx.request.body) {
    ctx.status = 400;
    ctx.body = {
      error: `expected an object in the body but got: ${ctx.request.body}`,
    };
    return;
  }
  const newName = `${new Date().getTime()}`;
  await writeJSONFile(ctx, newName);
  await uploadFile.upload(newName);
  await removeFile(newName);
  ctx.status = 200;
  next();
});

router.get('/auth', async (ctx) => {
  ctx.body = {
    message: ctx.request.query.code,
  };
});


app.use(router.routes());
app.use(router.allowedMethods());

module.exports = app;
