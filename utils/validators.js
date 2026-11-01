// Money is stored as a whole number of the smallest unit (paise/cents), never as a float
exports.wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };
exports.contactPattern = [/^[0-9+\-\s]{7,15}$/, 'Contact must be 7-15 digits'];
