const knex = require('knex')
const app = require('../src/app')
const { makeArticlesArray } = require('./articles.fixtures')
const supertest = require('supertest')

describe('Articles Endpoints', function () {
  let db

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('clean the table', () => db('blogful_articles').truncate())

  afterEach('cleanup', () => db('blogful_articles').truncate())

  describe(`GET /api/articles`, () => {
    context(`Given no articles`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/articles')
          .expect(200, [])
      })
    })

    context('Given there are articles in the database', () => {
      const testArticles = makeArticlesArray()

      beforeEach('insert articles', () => {
        return db
          .into('blogful_articles')
          .insert(testArticles)
      })

      it('responds with 200 and all of the articles', () => {
        return supertest(app)
          .get('/api/articles')
          .expect(200, testArticles)
      })
    })
  })

  describe(`GET /api/articles/:article_id`, () => {
    context(`Given no articles`, () => {
      it(`responds with 404`, () => {
        const articleId = 123456
        return supertest(app)
          .get(`/api/articles/${articleId}`)
          .expect(404, { error: { message: `Article doesn't exist` } })
      })
    })

    context('Given there are articles in the database', () => {
      const testArticles = makeArticlesArray()

      beforeEach('insert articles', () => {
        return db
          .into('blogful_articles')
          .insert(testArticles)
      })

      it('responds with 200 and the specified article', () => {
        const articleId = 2
        const expectedArticle = testArticles[articleId - 1]
        return supertest(app)
          .get(`/api/articles/${articleId}`)
          .expect(200, expectedArticle)
      })
    })

    context(`Given an XSS attack article`, () => {
      const maliciousArticle = {
        id: 911,
        title: 'Naughty naughty very naughty <script>alert("xss");</script>',
        style: 'How-to',
        content: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`
      }

      beforeEach('insert malicious article', () => {
        return db
          .into('blogful_articles')
          .insert([maliciousArticle])
      })

    })

  })

  describe(`POST /api/articles`, () => {
    it(`creates an article, responding with 201 and the new article`, function () {
      this.retries(3)
      const newArticle = {
        title: 'Test new article',
        style: 'Listicle',
        content: 'Test new article content...'
      }
      return supertest(app)
        .post('/api/articles/')
        .send(newArticle)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newArticle.title)
          expect(res.body.style).to.eql(newArticle.style)
          expect(res.body.content).to.eql(newArticle.content)
          expect(res.body).to.have.property('id')
          expect(res.headers.location).to.eql(`/api/articles/${res.body.id}`)
          const expected = new Date().toLocaleString()
          const actual = new Date(res.body.date_published).toLocaleString()
          expect(actual).to.eql(expected)
        })
        .then(res =>
          supertest(app)
            .get(`/api/articles/${res.body.id}`)
            .expect(res.body)
        )
    })


    describe(`DELETE /api/articles/:article_id`, () => {
      context('Given there are articles in the database', () => {
        const testArticles = makeArticlesArray()

        beforeEach('insert articles', () => {
          return db
            .into('blogful_articles')
            .insert(testArticles)
        })

        it('responds with 204 and removes the article', () => {
          const idToRemove = 2
          const expectedArticles = testArticles.filter(article => article.id !== idToRemove)
          return supertest(app)
            .delete(`/api/articles/${idToRemove}`)
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/articles/`)
                .expect(expectedArticles)
            )
        })
      })
    })

    describe.only(`PATCH /api/articles/:article_id`, () => {
      context(`Given no articles`, () => {
        it(`responds with 404`, () => {
          const articleId = 123456
          return supertest(app)
            .patch(`/api/articles/${articleId}`)
            .expect(404, { error: { message: `Article doesn't exist` } })
        })
      })
      context('Given there are articles in the database', () => {
        const testArticles = makeArticlesArray()

        beforeEach('insert articles', () => {
          return db
            .into('blogful_articles')
            .insert(testArticles)
        })
        it('responds with 204 and updates the article', () => {
          const idToUpdate = 2
          const updateArticle = {
            title: 'updated article title',
            style: 'Interview',
            content: 'updated article content',
          }
         const expectedArticle = {
           ...testArticles[idToUpdate - 1],
           ...updateArticle
         }
          return supertest(app)
            .patch(`/api/articles/${idToUpdate}`)
            .send(updateArticle)
            .expect(204)
           .then(res =>
             supertest(app)
               .get(`/api/articles/${idToUpdate}`)
               .expect(expectedArticle)
           )
        })


    })


    //test if title is missing
    // it(`responds with 400 and an error message when the 'title' is missing`, () => {
    //   return supertest(app)
    //     .post('/articles')
    //     .send({
    //       style: 'Listicle',
    //       content: 'Test new article content...'
    //     })
    //     .expect(400, {
    //       error: { message: `Missing 'title' in request body` }
    //     })
    // })

    // // test if content is missing 
    // it(`responds with 400 and an error message when the 'content' is missing`, () => {
    //   return supertest(app)
    //     .post('/articles')
    //     .send({
    //       title: 'Test new article',
    //       style: 'Listicle',
    //     })
    //     .expect(400, {
    //       error: { message: `Missing 'content' in request body` }
    //     })
    // })
    // // test if style is missing 
    // it(`responds with 400 and an error message when the 'style' is missing`, () => {
    //   return supertest(app)
    //     .post('/articles')
    //     .send({
    //       title: 'Test new article',
    //       content: 'Test new article content...'
    //     })
    //     .expect(400, {
    //       error: { message: `Missing 'style' in request body` }
    //     })
    // })
    /////////////////////////////////////////////////////////////////////////////////////
    ///// REFACTOR TESTS BECAUSE THEY ARE REPETATIVE ///////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////
    const requiredFields = ['title', 'style', 'content']

    requiredFields.forEach(field => {
      const newArticle = {
        title: 'Test new artilce',
        style: 'Listcicle',
        content: 'Test new article content...'
      }

      it(`responds with 400 and an error message when the '${field}' is missing`, () => {
        delete newArticle[field]

        return supertest(app)
          .post('/api/articles')
          .send(newArticle)
          .expect(400, {
            error: { message: `Missing '${field}' in request body` }
          })
      })
    })

  })
})