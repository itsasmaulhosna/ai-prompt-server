const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
    const db = client.db('ai-prompt');
    const promptCollection = db.collection('prompts');
    const reportCollection = db.collection('reports');
    const paymentCollection = db.collection('payments');
    const reviewCollection = db.collection('reviews');
    const premiumCollection = db.collection('premiumUsers');
    const usersCollection = db.collection('user');
    // add prompt
    app.post('/api/prompts', async (req, res) => {
      try {
        const prompt = req.body;

        const newPrompt = {
          title: prompt.title,
          description: prompt.description,
          content: prompt.content,
          category: prompt.category,
          aiTool: prompt.aiTool,
          tags: prompt.tags || [],
          difficulty: prompt.difficulty,
          thumbnail: prompt.thumbnail,
          visibility: prompt.visibility,
          userEmail: prompt.userEmail,
          copyCount: 0,
          status: 'pending',

          accessType: prompt.visibility === 'private' ? 'premium' : 'free',

          createdAt: new Date(),
        };

        const result = await promptCollection.insertOne(newPrompt);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to create prompt',
        });
      }
    });
    // all prompts
    app.get('/api/marketplace-prompts', async (req, res) => {
      try {
        const { aiTool, category, difficulty } = req.query;

        const query = {};

        if (aiTool && aiTool !== 'All') {
          query.aiTool = aiTool;
        }

        if (category && category !== 'All') {
          query.category = category;
        }

        if (difficulty && difficulty !== 'All') {
          query.difficulty = difficulty;
        }

        const prompts = await promptCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          data: prompts,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to fetch prompts',
        });
      }
    });

    // featured prompts
    app.get('/api/prompts/featured', async (req, res) => {
      try {
        console.log('FEATURED ROUTE HIT');

        const result = await promptCollection.find({}).limit(6).toArray();

        console.log(result);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('FEATURED ERROR =>', error);

        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // details
    app.get('/api/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({
            success: false,
            message: 'Prompt not found',
          });
        }

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error(error);

        res.status(500).json({
          success: false,
          message: 'Server Error',
        });
      }
    });
    // copy count
    app.patch('/api/prompts/:id/copy', async (req, res) => {
      try {
        const { id } = req.params;

        await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              copyCount: 1,
            },
          },
        );

        const updatedPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          copyCount: updatedPrompt.copyCount,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // rating
    app.patch('/api/prompts/:id/rating', async (req, res) => {
      try {
        const { id } = req.params;
        const { rating } = req.body;

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
          });
        }

        const currentRating = prompt.rating || 0;

        const currentCount = prompt.ratingCount || 0;

        const newAverage =
          (currentRating * currentCount + rating) / (currentCount + 1);

        await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              rating: Number(newAverage.toFixed(1)),
            },
            $inc: {
              ratingCount: 1,
            },
          },
        );

        const updatedPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          rating: updatedPrompt.rating,
          ratingCount: updatedPrompt.ratingCount,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // creator analytic
    app.get('/api/creator/analytics', async (req, res) => {
      try {
        const prompts = await promptCollection.find({}).toArray();

        const totalPrompts = prompts.length;

        const totalCopies = prompts.reduce(
          (sum, prompt) => sum + (prompt.copyCount || 0),
          0,
        );

        const totalBookmarks = prompts.reduce(
          (sum, prompt) => sum + (prompt.bookmarksCount || 0),
          0,
        );

        const copiesData = prompts.map((prompt) => ({
          name: prompt.title.slice(0, 15),
          copies: prompt.copyCount || 0,
        }));

        const growthMap = {};

        prompts.forEach((prompt) => {
          const month = new Date(prompt.createdAt).toLocaleString('default', {
            month: 'short',
          });

          growthMap[month] = (growthMap[month] || 0) + 1;
        });

        const growthData = Object.keys(growthMap).map((month) => ({
          month,
          prompts: growthMap[month],
        }));

        res.send({
          success: true,
          totalPrompts,
          totalCopies,
          totalBookmarks,
          copiesData,
          growthData,
          recentPrompts: prompts.slice(-5).reverse(),
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // admin all prompts
    app.get('/api/prompts', async (req, res) => {
      const prompts = await promptCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.send({
        success: true,
        data: prompts,
      });
    });
    // admin approve
    app.patch('/api/prompts/:id/approve', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: 'approved',
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // change access type
    app.patch('/api/prompts/:id/access', async (req, res) => {
      try {
        const { id } = req.params;
        const { accessType } = req.body;

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              accessType,
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // admin reject
    app.patch('/api/prompts/:id/reject', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: 'rejected',
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    // delete prompt
    app.delete('/api/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // report create
    app.post('/api/reports', async (req, res) => {
      try {
        const report = req.body;

        report.status = 'pending';
        report.createdAt = new Date();

        const result = await reportCollection.insertOne(report);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // get all reports
    app.get('/api/reports', async (req, res) => {
      try {
        const reports = await reportCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reports);
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // admin analytics
    app.get('/api/admin/analytics', async (req, res) => {
      try {
        // Total Prompts
        const totalPrompts = await promptCollection.countDocuments();

        // Total Reviews
        const totalReviews = await reportCollection.countDocuments();

        // Total Copies
        const copiesResult = await promptCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalCopies: {
                  $sum: '$copyCount',
                },
              },
            },
          ])
          .toArray();

        const totalCopies = copiesResult[0]?.totalCopies || 0;

        // Total Revenue
        // const revenueResult =
        //   await paymentCollection
        //     .aggregate([
        //       {
        //         $group: {
        //           _id: null,
        //           totalRevenue: {
        //             $sum: '$amount',
        //           },
        //         },
        //       },
        //     ])
        //     .toArray()

        // const totalRevenue =
        //   revenueResult[0]?.totalRevenue || 0
        const totalRevenue = 0;

        res.send({
          success: true,
          data: {
            totalPrompts,
            totalReviews,
            totalCopies,
            totalRevenue,
          },
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: 'Failed to load analytics',
        });
      }
    });
    // get admin/users
    app.get('/api/users', async (req, res) => {
      try {
        const users = await usersCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send(users);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    // update admin/user
    app.patch('/api/users/:id/role', async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role,
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    // delete admin/user
    app.delete('/api/users/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    // user add prompts
    app.post('/api/prompts', async (req, res) => {
      try {
        const prompt = req.body;

        const newPrompt = {
          ...prompt,
          status: 'pending', // 🔥 IMPORTANT
          createdAt: new Date(),
        };

        await promptCollection.insertOne(newPrompt);

        res.send({
          success: true,
          message: 'Prompt submitted for review',
        });
      } catch (error) {
        res.status(500).send({ success: false });
      }
    });
    // user my prompts
    app.get('/api/prompts/user/:email', async (req, res) => {
      try {
        const result = await promptCollection
          .find({ userEmail: req.params.email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).send({ success: false });
      }
    });
    // admin approve prompt
    app.get('/api/admin/prompts', async (req, res) => {
      try {
        const result = await promptCollection
          .find({ status: 'pending' })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).send({ success: false });
      }
    });
    // marketplace prompts approve
    app.get('/api/marketplace-prompts', async (req, res) => {
      const result = await promptCollection
        .find({
          status: 'approved',
          visibility: 'public',
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.send({
        success: true,
        data: result,
      });
    });
    //add bookmark
    app.post('/api/bookmarks', async (req, res) => {
      const { userEmail, promptId } = req.body;

      const exists = await db.collection('bookmarks').findOne({
        userEmail,
        promptId,
      });

      if (exists) {
        return res.send({ success: false, message: 'Already bookmarked' });
      }

      await db.collection('bookmarks').insertOne({
        userEmail,
        promptId,
        createdAt: new Date(),
      });

      // ⭐ IMPORTANT: increase bookmark count in prompt
      await promptCollection.updateOne(
        { _id: new ObjectId(promptId) },
        { $inc: { bookmarksCount: 1 } },
      );

      res.send({ success: true });
    });
    // remove bookmark
    app.delete('/api/bookmarks', async (req, res) => {
      const { userEmail, promptId } = req.body;

      const deleted = await db.collection('bookmarks').deleteOne({
        userEmail,
        promptId,
      });

      if (deleted.deletedCount > 0) {
        await promptCollection.updateOne(
          { _id: new ObjectId(promptId) },
          { $inc: { bookmarksCount: -1 } },
        );
      }

      res.send({ success: true });
    });
    // user bookmark
    app.get('/api/bookmarks/:email', async (req, res) => {
      const email = req.params.email;

      const bookmarks = await db
        .collection('bookmarks')
        .find({ userEmail: email })
        .toArray();

      const ids = bookmarks.map((b) => new ObjectId(b.promptId));

      const prompts = await promptCollection
        .find({ _id: { $in: ids } })
        .toArray();

      res.send({
        success: true,
        data: prompts,
      });
    });
    // post review
    app.post('/api/reviews', async (req, res) => {
      const review = req.body;

      const newReview = {
        promptId: review.promptId,
        userEmail: review.userEmail,
        userName: review.userName,
        rating: review.rating,
        text: review.text,
        createdAt: new Date(),
      };

      await reviewCollection.insertOne(newReview);

      res.send({ success: true });
    });
    // get review
    app.get('/api/reviews/:promptId', async (req, res) => {
      const result = await reviewCollection
        .find({ promptId: req.params.promptId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send({ success: true, data: result });
    });
    // user review
    app.get('/api/reviews/user/:email', async (req, res) => {
      const result = await reviewCollection
        .find({ userEmail: req.params.email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send({ success: true, data: result });
    });
    //post payment api
    app.post('/api/payments', async (req, res) => {
      try {
        const payment = req.body;

        const result = await paymentCollection.insertOne({
          ...payment,
          createdAt: new Date(),
        });

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // upgrade api
    app.post('/api/users/upgrade', async (req, res) => {
      try {
        const { email } = req.body;

        const exists = await premiumCollection.findOne({
          email,
        });

        if (exists) {
          return res.send({
            success: true,
            alreadyPremium: true,
          });
        }

        await premiumCollection.insertOne({
          email,
          plan: 'premium',
          amount: 5,
          createdAt: new Date(),
        });

        res.send({
          success: true,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // check perium api
    app.get('/api/users/premium/:email', async (req, res) => {
      const result = await premiumCollection.findOne({
        email: req.params.email,
      });

      res.send({
        success: true,
        isPremium: !!result,
      });
    });
    // top creator
    app.get('/api/top-creators', async (req, res) => {
      try {
        const result = await promptCollection
          .aggregate([
            {
              $group: {
                _id: '$userEmail',
                totalPrompts: { $sum: 1 },
              },
            },
            {
              $sort: {
                totalPrompts: -1,
              },
            },
            {
              $limit: 6,
            },
          ])
          .toArray();

        const creators = await Promise.all(
          result.map(async (creator) => {
            const user = await usersCollection.findOne({
              email: creator._id,
            });

            return {
              email: creator._id,
              name: user?.name || 'Unknown',
              image: user?.image || '',
              role: user?.role || 'creator',
              totalPrompts: creator.totalPrompts,
            };
          }),
        );

        res.send({
          success: true,
          data: creators,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });
    // users review
    app.get('/api/reviews', async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send({
          success: true,
          data: reviews,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });
    // user make perium
    app.patch('/api/users/make-premium', async (req, res) => {
      const { email } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            isPremium: true,
          },
        },
      );

      res.send({
        success: true,
        result,
      });
    });
    // check perium
    app.get('/api/users/premium/:email', async (req, res) => {
      const user = await usersCollection.findOne({
        email: req.params.email,
      });

      res.send({
        isPremium: user?.isPremium || false,
      });
    });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
