// dummy projects
exports.getAllProjects = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: [{ id: 1, title: 'First Project' }],
  });
};

exports.createProject = async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'Project created (mock)',
  });
};

exports.getProject = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { id: req.params.id, title: 'Mock Project' },
  });
};

exports.updateProject = async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: `Project ${req.params.id} updated (mock)`,
  });
};

exports.deleteProject = async (req, res) => {
  res.status(204).json({
    status: 'success',
    message: `Project ${req.params.id} deleted (mock)`,
  });
};
