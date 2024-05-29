/**
 * Express application for the Croc'top API.
 * @module app
 */

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const User = require('./models/user');
const Post = require('./models/post');
const Comment = require('./models/comment');

const app = express();
app.use(express.json());

const url = 'mongodb://localhost:27017/croc\'top';
let db;

mongoose.connect(url)
    .then(() => console.log(`Connected to database croc'top`))
    .catch(err => console.error('Failed to connect to MongoDB', err));

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

/**
 * Route handler for the root endpoint.
 * @name GET /
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get("/", (req, res) => {
    res.send({ hello: "world" });
});

/**
 * Route handler for user signup.
 * @name POST /signup
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/signup', async (req, res) => {
  const { firstname, lastname, username, email, password, birthday, bio, picture_avatar } = req.body;
  try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
          firstname,
          lastname,
          username,
          email,
          password: hashedPassword,
          birthday,
          bio,
          picture_avatar
      });
      const savedUser = await newUser.save();
      res.status(201).json({ message: 'User created', user: savedUser });
  } catch (err) {
      res.status(400).json({ message: err.message });
  }
});

/**
 * Route handler for user signin.
 * @name POST /signin
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/signin', async (req, res) => {
  const { email, username, password } = req.body;
  try {
      const user = await User.findOne({ $or: [{ email }, { username }] });
      if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: 'Invalid credentials' });
      }

      user.last_login = Date.now();
      await user.save();

      const accessToken = jwt.sign({ userId: user._id, role: user.role }, 'secretKey', { expiresIn: '7d' });
      const refreshToken = jwt.sign({ userId: user._id, role: user.role }, 'refreshSecretKey', { expiresIn: '7d' });

      res.json({ accessToken, refreshToken, user });
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Middleware function to authenticate JWT token.
 * @name authenticateToken
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Next middleware function.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'secretKey', (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
  });
};

/**
 * Route handler for protected route.
 * @name GET /protected
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/protected', authenticateToken, (req, res) => {
  res.send('This is a protected route');
});

/**
 * Route handler for token refresh.
 * @name POST /token
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'refreshSecretKey', (err, user) => {
      if (err) return res.sendStatus(403);

      const accessToken = jwt.sign({ userId: user.userId, role: user.role }, 'secretKey', { expiresIn: '7d' });
      res.json({ accessToken });
  });
});

/**
 * Route handler for getting all users.
 * @name GET /users
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/users', authenticateToken, async (req, res) => {
  try {
      const users = await User.find({}, 'username');
      res.json(users);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Route handler for getting a user by ID.
 * @name GET /users/:id
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Route handler for updating a user.
 * @name PUT /users/:id
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/users/me', authenticateToken, async (req, res) => {
    const { firstname, lastname, username, email, password, birthday, bio, picture_avatar } = req.body;

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (firstname) user.firstname = firstname;
        if (lastname) user.lastname = lastname;
        if (username) user.username = username;
        if (email) user.email = email;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }
        if (birthday) user.birthday = birthday;
        if (bio) user.bio = bio;
        if (picture_avatar) user.picture_avatar = picture_avatar;

        const updatedUser = await user.save();
        res.json({ message: 'User updated', user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for creating a new post.
 * @name POST /posts
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/posts', authenticateToken, async (req, res) => {
  const { title, photos, category, prepTime, cookTime, allergens, prepSteps } = req.body;
  try {
      const newPost = new Post({
          title,
          photos,
          category,
          prepTime,
          cookTime,
          allergens,
          prepSteps,
          author: req.user.userId
      });
      const savedPost = await newPost.save();
      const user = await User.findById(req.user.userId);
      user.posts.push(savedPost._id);
      await user.save();
      res.status(201).json({ message: 'Post created', post: savedPost });
  } catch (err) {
      res.status(400).json({ message: err.message });
  }
});

/**
 * Route handler for getting all posts.
 * @name GET /posts
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/posts', async (req, res) => {
  try {
      const posts = await Post.find({ archived: false }).populate('author', 'username');
      res.json(posts);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Route handler for getting a post by ID.
 * @name GET /posts/:id
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/posts/:id', async (req, res) => {
  try {
      const post = await Post.findById(req.params.id).populate('author', 'username');
      if (!post) {
          return res.status(404).json({ message: 'Post not found' });
      }
      res.json(post);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Route handler for getting all posts by a user.
 * @name GET /users/:id/posts
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/users/:id/posts', authenticateToken, async (req, res) => {
  try {
      const posts = await Post.find({ author: req.params.id }).populate('author', 'username');
      if (!posts) {
          return res.status(404).json({ message: 'No posts found for this user' });
      }
      res.json(posts);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});

/**
 * Route handler for updating a post.
 * @name PUT /posts/:id
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/posts/:id', authenticateToken, async (req, res) => {
    const { title, photos, category, prepTime, cookTime, allergens, prepSteps } = req.body;
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found'});
        }

        if (post.author.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this post' });
        }

        if (title) post.title = title;
        if (photos) post.photos = photos;
        if (category) post.category = category;
        if (prepTime) post.prepTime = prepTime;
        if (cookTime) post.cookTime = cookTime;
        if (allergens) post.allergens = allergens;
        if (prepSteps) post.prepSteps = prepSteps;

        const updatedPost = await post.save();
        res.json({ message: 'Post updated', post: updatedPost });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route to archive a post.
 * @name PUT /posts/:id/archive
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/posts/:id/archive', authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to archive this post' });
        }

        post.archived = true;
        const archivedPost = await post.save();
        res.json({ message: 'Post archived', post: archivedPost });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route to list archived posts of the authenticated user.
 * @name GET /users/me/archived-posts
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/users/me/archived-posts', authenticateToken, async (req, res) => {
    try {
        const posts = await Post.find({ author: req.user.userId, archived: true }).populate('author', 'username');
        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route to unarchive a post.
 * @name PUT /posts/:id/unarchive
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/posts/:id/unarchive', authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to unarchive this post' });
        }

        post.archived = false;
        const unarchivedPost = await post.save();
        res.json({ message: 'Post unarchived', post: unarchivedPost });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route to delete a post.
 * @name DELETE /posts/:id
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.delete('/posts/:id', authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this post' });
        }

        await Post.findByIdAndDelete(req.params.id);

        const user = await User.findById(req.user.userId);
        user.posts.pull(post._id);
        await user.save();

        res.json({ message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for adding a comment to a post.
 * @name POST /posts/:id/comments
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/posts/:id/comments', authenticateToken, async (req, res) => {
    const { content } = req.body;

    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const newComment = new Comment({
            user: req.user.userId,
            post: req.params.id,
            content
        });

        const savedComment = await newComment.save();

        post.comments.push(savedComment._id);
        await post.save();

        res.status(201).json({ message: 'Comment added', comment: savedComment });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for deleting a comment from a post.
 * @name DELETE /posts/:postId/comments/:commentId
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.delete('/posts/:postId/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { postId, commentId } = req.params;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to delete comments on this post' });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        post.comments = post.comments.filter(comment => comment.toString() !== commentId);
        await post.save();

        await Comment.deleteOne({ _id: commentId });

        res.json({ message: 'Comment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for liking a post.
 * @name PUT /posts/:id/like
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/posts/:id/like', authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.likes.includes(req.user.userId)) {
            return res.status(400).json({ message: 'You have already liked this post' });
        }

        post.likes.push(req.user.userId);
        await post.save();

        res.json({ message: 'Post liked', post });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for unliking a post.
 * @name PUT /posts/:id/unlike
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/posts/:id/unlike', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;

        // Trouver le post
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Vérifier si l'utilisateur a déjà liké le post
        if (!post.likes.includes(userId)) {
            return res.status(400).json({ message: 'You have not liked this post' });
        }

        // Retirer l'ID de l'utilisateur de la liste des likes
        post.likes = post.likes.filter(id => id.toString() !== userId);
        await post.save();

        res.json({ message: 'Post unliked', post });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Route handler for following a user.
 * @name PUT /users/:id/follow
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/users/:id/follow', authenticateToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.followers.includes(currentUserId)) {
            return res.status(400).json({ message: 'You already follow this user' });
        }

        targetUser.followers.push(currentUserId);
        await targetUser.save();

        const currentUser = await User.findById(currentUserId);
        currentUser.following.push(targetUserId);
        await currentUser.save();

        res.json({ message: 'User followed', targetUser, currentUser });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


/**
 * Route handler for unfollowing a user.
 * @name PUT /users/:id/unfollow
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.put('/users/:id/unfollow', authenticateToken, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.id);
        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentUser = await User.findById(req.user.userId);

        if (!currentUser.following.includes(userToUnfollow._id)) {
            return res.status(400).json({ message: 'You are not following this user' });
        }

        currentUser.following = currentUser.following.filter(id => id.toString() !== userToUnfollow._id.toString());
        userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== currentUser._id.toString());

        await currentUser.save();
        await userToUnfollow.save();

        res.json({ message: 'User unfollowed', currentUser, userToUnfollow });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

