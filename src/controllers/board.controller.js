const boardService = require('../services/board.service');

const create = async (req, res, next) => {
  try {
    const { title, workspaceId } = req.body;
    if (!title || !workspaceId) {
      return res.status(400).json({ message: 'Title and workspaceId are required' });
    }

    const board = await boardService.createBoard({ title, workspaceId });
    return res.status(201).json(board);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const board = await boardService.getBoardById(req.params.id);
    return res.status(200).json(board);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const board = await boardService.updateBoard({ boardId: req.params.id, title });
    return res.status(200).json(board);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await boardService.deleteBoard(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const createList = async (req, res, next) => {
  try {
    const { title, position } = req.body;
    if (!title || position === undefined) {
      return res.status(400).json({ message: 'Title and position are required' });
    }

    const list = await boardService.createList({ boardId: req.params.id, title, position });
    return res.status(201).json(list);
  } catch (error) {
    next(error);
  }
};

const updateList = async (req, res, next) => {
  try {
    const { title, position } = req.body;
    const list = await boardService.updateList({ listId: req.params.id, title, position });
    return res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

const deleteList = async (req, res, next) => {
  try {
    await boardService.deleteList(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getById, update, remove, createList, updateList, deleteList };