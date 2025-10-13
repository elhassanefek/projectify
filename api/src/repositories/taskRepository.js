const Task = require('../models/taskModel');
require('../models/commentModel');
class TaskRepository {
  async create(data) {
    return await Task.create(data);
  }

  async find(filter) {
    return await Task.find(filter);
  }

  async findById(id, populate = []) {
    let query = Task.findById(id);
    populate.forEach((path) => (query = query.populate(path)));
    return await query;
  }

  async update(id, updates) {
    return await Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await Task.findByIdAndDelete(id);
  }

  async count(filter) {
    return await Task.countDocuments(filter);
  }

  async aggregate(pipeline) {
    return await Task.aggregate(pipeline);
  }
}

module.exports = new TaskRepository();
