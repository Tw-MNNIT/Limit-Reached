
import { useEffect, useState } from "react";
import {
  Brain,
  Search,
  Plus,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  X,
  RefreshCw
} from "lucide-react";

import api from "../services/api";

const categories = [
  "academics",
  "hobbies",
  "friends",
  "music",
  "preferences",
  "plans",
  "personal",
  "other"
];

export default function MemoryBank() {
  const [memories, setMemories] = useState([]);
  const [folders, setFolders] = useState([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    category: "other",
    folderId: ""
  });

  const [folderName, setFolderName] = useState("");
  const [showFolderForm, setShowFolderForm] = useState(false);

  const [clearingMemories, setClearingMemories] = useState(false);

  // Load folders
  const loadFolders = async () => {
    const response = await api.get("/memory-folders");
    setFolders(response.data.folders || []);
  };

  // Load memories
  const loadMemories = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        archived: "false"
      };

      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (selectedFolder) params.folderId = selectedFolder;

      const response = await api.get("/memories", { params });

      setMemories(response.data.memories || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load memories."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial folder loading
  useEffect(() => {
    loadFolders().catch(() => {
      setError("Unable to load memory folders.");
    });
  }, []);

  // Reload memories when filters change
  useEffect(() => {
    loadMemories();
  }, [search, category, selectedFolder]);

  // Open add memory form
  const openAddForm = () => {
    setEditingMemory(null);

    setForm({
      title: "",
      summary: "",
      category: "other",
      folderId: ""
    });

    setShowMemoryForm(true);
  };

  // Open edit memory form
  const openEditForm = (memory) => {
    setEditingMemory(memory);

    setForm({
      title: memory.title,
      summary: memory.summary,
      category: memory.category,
      folderId:
        typeof memory.folderId === "object"
          ? memory.folderId?._id || ""
          : memory.folderId || ""
    });

    setShowMemoryForm(true);
  };

  // Save memory
  const saveMemory = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      folderId: form.folderId || null
    };

    try {
      if (editingMemory) {
        await api.put(
          `/memories/${editingMemory._id}`,
          payload
        );
      } else {
        await api.post("/memories", payload);
      }

      setShowMemoryForm(false);

      await loadMemories();
      await loadFolders();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        "Unable to save memory."
      );
    }
  };

  // Delete individual memory
  const deleteMemory = async (id) => {
    if (!window.confirm("Delete this memory permanently?")) {
      return;
    }

    try {
      await api.delete(`/memories/${id}`);
      await loadMemories();
    } catch (err) {
      alert("Unable to delete memory.");
    }
  };

  // Clear all memories
  const clearAllMemories = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete ALL your memories, including archived memories? This action cannot be undone. Your folders and conversations will remain."
    );

    if (!confirmed) return;

    try {
      setClearingMemories(true);

      const response = await api.delete("/memories");

      setSearch("");
      setCategory("");
      setSelectedFolder("");

      // Reload the memory list
      await loadMemories();

      alert(
        `${response.data.deletedCount} memories deleted successfully.`
      );
    } catch (err) {
      alert(
        err.response?.data?.message ||
        "Unable to clear memories."
      );
    } finally {
      setClearingMemories(false);
    }
  };

  // Move memory to another folder
  const moveMemory = async (memory) => {
    const destination = window.prompt(
      "Enter the destination folder name, or leave empty for uncategorized:",
      ""
    );

    if (destination === null) return;

    const folder = folders.find(
      (item) =>
        item.name.toLowerCase() === destination.trim().toLowerCase()
    );

    if (destination.trim() && !folder) {
      alert("Folder not found. Please create it first.");
      return;
    }

    try {
      await api.patch(`/memories/${memory._id}/move`, {
        folderId: folder?._id || null
      });

      await loadMemories();
    } catch (err) {
      alert("Unable to move memory.");
    }
  };

  // Create folder
  const createFolder = async (event) => {
    event.preventDefault();

    if (!folderName.trim()) return;

    try {
      await api.post("/memory-folders", {
        name: folderName.trim()
      });

      setFolderName("");
      setShowFolderForm(false);

      await loadFolders();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        "Unable to create folder."
      );
    }
  };

  // Rename or delete folder
  const manageFolder = async (folder) => {
    const action = window.prompt(
      `Folder: ${folder.name}\nType "rename" or "delete":`
    );

    if (!action) return;

    if (action.toLowerCase() === "rename") {
      const newName = window.prompt("Enter the new folder name:");

      if (!newName?.trim()) return;

      try {
        await api.put(`/memory-folders/${folder._id}`, {
          name: newName.trim()
        });

        await loadFolders();
      } catch (err) {
        alert(
          err.response?.data?.message ||
          "Unable to rename folder."
        );
      }
    }

    if (action.toLowerCase() === "delete") {
      if (!window.confirm(
        "Delete this folder? Its memories will become uncategorized."
      )) return;

      try {
        await api.delete(`/memory-folders/${folder._id}`);

        setSelectedFolder("");

        await loadFolders();
        await loadMemories();
      } catch (err) {
        alert("Unable to delete folder.");
      }
    }
  };

  return (
    <div className="section-page memory-page">

      {/* Header */}
      <div className="memory-header">
        <div>
          <div className="memory-heading">
            <Brain size={28} />
            <h1>Memory Bank</h1>
          </div>

          <p>
            Your personal knowledge, preferences and important memories.
          </p>
        </div>

        <div className="memory-header-actions">
          <button
            className="memory-danger-btn"
            onClick={clearAllMemories}
            disabled={clearingMemories}
          >
            <Trash2 size={17} />
            {clearingMemories ? "Clearing..." : "Clear All"}
          </button>

          <button
            className="memory-primary-btn"
            onClick={openAddForm}
          >
            <Plus size={18} />
            Add Memory
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="memory-toolbar">
        <div className="memory-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search your memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSelectedFolder("");
          }}
        >
          <option value="">All Categories</option>

          {categories.map((item) => (
            <option key={item} value={item}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>

        <button
          className="memory-icon-btn"
          onClick={loadMemories}
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Main content */}
      <div className="memory-content">

        {/* Folders sidebar */}
        <aside className="memory-folders">
          <div className="memory-folder-heading">
            <h3>Folders</h3>

            <button
              className="memory-icon-btn"
              onClick={() => setShowFolderForm(!showFolderForm)}
              title="Create folder"
            >
              <FolderPlus size={18} />
            </button>
          </div>

          {showFolderForm && (
            <form
              onSubmit={createFolder}
              className="folder-create-form"
            >
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Folder name"
                required
              />

              <button type="submit">Create</button>
            </form>
          )}

          <button
            className={`memory-folder-item ${
              !selectedFolder ? "selected" : ""
            }`}
            onClick={() => {
              setSelectedFolder("");
              setCategory("");
            }}
          >
            <Brain size={17} />
            <span>All Memories</span>
          </button>

          {folders.map((folder) => (
            <div
              key={folder._id}
              className={`memory-folder-item ${
                selectedFolder === folder._id ? "selected" : ""
              }`}
            >
              <button
                className="memory-folder-select"
                onClick={() => {
                  setSelectedFolder(folder._id);
                  setCategory("");
                }}
              >
                <Folder size={17} />
                <span>{folder.name}</span>
              </button>

              <button
                className="memory-folder-manage"
                onClick={() => manageFolder(folder)}
                title="Manage folder"
              >
                ...
              </button>
            </div>
          ))}
        </aside>

        {/* Memory list */}
        <section className="memory-list">
          <div className="memory-list-heading">
            <div>
              <h2>
                {selectedFolder
                  ? folders.find((f) => f._id === selectedFolder)?.name
                  : category
                    ? category.charAt(0).toUpperCase() + category.slice(1)
                    : "All Memories"}
              </h2>

              <p>{memories.length} memories found</p>
            </div>
          </div>

          {loading ? (
            <p className="memory-status">
              Loading memories...
            </p>
          ) : error ? (
            <p className="memory-status memory-error">
              {error}
            </p>
          ) : memories.length === 0 ? (
            <div className="memory-empty">
              <Brain size={42} />

              <h3>No memories found</h3>

              <p>
                Memories from your conversations will appear here.
                You can also add them manually.
              </p>

              <button
                className="memory-primary-btn"
                onClick={openAddForm}
              >
                <Plus size={17} />
                Add your first memory
              </button>
            </div>
          ) : (
            <div className="memory-grid">
              {memories.map((memory) => (
                <article
                  className="memory-card"
                  key={memory._id}
                >
                  <div className="memory-card-top">
                    <span className="memory-category">
                      {memory.category}
                    </span>

                    <div className="memory-actions">
                      <button
                        onClick={() => openEditForm(memory)}
                        title="Edit memory"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => moveMemory(memory)}
                        title="Move memory"
                      >
                        <ArrowRightLeft size={16} />
                      </button>

                      <button
                        onClick={() => deleteMemory(memory._id)}
                        title="Delete memory"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3>{memory.title}</h3>

                  <p>{memory.summary}</p>

                  <div className="memory-card-footer">
                    <Folder size={14} />

                    <span>
                      {memory.folderId?.name || "Uncategorized"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add/Edit memory modal */}
      {showMemoryForm && (
        <div className="memory-modal-overlay">
          <form
            className="memory-modal"
            onSubmit={saveMemory}
          >
            <div className="memory-modal-header">
              <h2>
                {editingMemory ? "Edit Memory" : "Add Memory"}
              </h2>

              <button
                type="button"
                onClick={() => setShowMemoryForm(false)}
              >
                <X size={20} />
              </button>
            </div>

            <label>Title</label>

            <input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              maxLength={200}
              required
            />

            <label>Summary</label>

            <textarea
              value={form.summary}
              onChange={(e) =>
                setForm({ ...form, summary: e.target.value })
              }
              maxLength={5000}
              rows={5}
              required
            />

            <label>Category</label>

            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>

            <label>Folder</label>

            <select
              value={form.folderId}
              onChange={(e) =>
                setForm({ ...form, folderId: e.target.value })
              }
            >
              <option value="">Uncategorized</option>

              {folders.map((folder) => (
                <option key={folder._id} value={folder._id}>
                  {folder.name}
                </option>
              ))}
            </select>

            <div className="memory-modal-actions">
              <button
                type="button"
                className="memory-cancel-btn"
                onClick={() => setShowMemoryForm(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="memory-primary-btn"
              >
                Save Memory
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
