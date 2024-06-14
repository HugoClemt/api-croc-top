const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    photos: [{ type: String, required: true }],
    category: { 
        type: String, 
        required: true, 
        enum: ['Entrée', 'Plat principal', 'Dessert', 'Boisson', 'Apéritif', 'Snack'] 
    },
    prepTime: { type: Number, required: true }, 
    cookTime: { type: Number, required: true },
    allergens: [{ 
        type: String, 
        enum: ['Gluten', 'Crustacés', 'Oeufs', 'Poissons', 'Arachides', 'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites'] 
    }],
    prepSteps: [{ type: String, required: true }],
    ingredients: [{ 
        name: { type: String, required: true }, 
        quantity: { type: String, required: true }, 
        unit: { type: String, required: true }
    }],
    publishDate: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archived: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Post', postSchema);
