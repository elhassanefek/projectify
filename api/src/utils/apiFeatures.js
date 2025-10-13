class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering for operators
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  search(fields = []) {
    if (this.queryString.search && fields.length > 0) {
      const searchRegex = new RegExp(this.queryString.search, 'i');
      const searchConditions = fields.map((field) => ({
        [field]: searchRegex,
      }));
      this.query = this.query.find({ $or: searchConditions });
    }

    return this;
  }

  // Date range filtering
  dateRange(field) {
    if (this.queryString.dueDateFrom || this.queryString.dueDateTo) {
      const dateFilter = {};
      if (this.queryString.dueDateFrom) {
        dateFilter.$gte = new Date(this.queryString.dueDateFrom);
      }
      if (this.queryString.dueDateTo) {
        dateFilter.$lte = new Date(this.queryString.dueDateTo);
      }
      this.query = this.query.find({ [field]: dateFilter });
    }

    return this;
  }

  // Filter by array field (e.g., assignedTo)
  arrayFilter(field) {
    if (this.queryString[field]) {
      this.query = this.query.find({ [field]: this.queryString[field] });
    }

    return this;
  }
}

module.exports = APIFeatures;
