const WorkSpace = require('../models/workSpaceModel');

class WorkSpaceRepository {
  async create(data) {
    return await WorkSpace.create(data);
  }
  async find(filter) {
    return await WorkSpace.find(filter);
  }
  async findById(id, populate = []) {
    let query = WorkSpace.findById(id);

    populate.forEach((path) => (query = query.populate(path)));
    return await query;
  }
  async update(id, updates) {
    return await WorkSpace.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
  }
  async delete(filter) {
    return await WorkSpace.deleteOne(filter);
  }
  async deleteById(id) {
    return await WorkSpace.findByIdAndDelete(id);
  }
  async count() {
    return await WorkSpace.countDocuments();
  }
  async aggregate(pipeline) {
    return await WorkSpace.aggregate(pipeline);
  }
}

module.exports = new WorkSpaceRepository();
