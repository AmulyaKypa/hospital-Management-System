// Strict ObjectId check (mongoose.isValidObjectId accepts any 12-character string)
exports.isId = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
