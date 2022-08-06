// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { SourceControlInputBox } from "vscode";
import api from "./api";
import path = require("path");
import { Status, Repository, API } from "./git.d";

var git: API;

interface Commit {
  type: string;
  files: File[];
  count: number;
}

interface File {
  name: string;
  path: string;
}

const prefiexes: string[] = [];
prefiexes[Status.ADDED_BY_US] = "added";
prefiexes[Status.UNTRACKED] = "added";
prefiexes[Status.INDEX_ADDED] = "added";
prefiexes[Status.DELETED] = "deleted";
prefiexes[Status.INDEX_DELETED] = "deleted";
prefiexes[Status.MODIFIED] = "modified";
prefiexes[Status.INDEX_MODIFIED] = "modified";
prefiexes[Status.INDEX_RENAMED] = "renamed";

const preps = new Map<string, string>();
preps.set("added", "to");
preps.set("deleted", "from");
preps.set("modified", "in");
preps.set("renamed", "in");

function writeAutoCommit(repository: Repository) {
  let stagedChanges = repository.state.indexChanges;
  let unStagedChanges = repository.state.workingTreeChanges;
  let root = vscode.workspace.workspaceFolders?.[0];

  let changes = stagedChanges.length > 0 ? stagedChanges : unStagedChanges;

  if (changes.length === 0) {
    repository.inputBox.value = "";
    return;
  }

  let commits: Commit[] = [
    { type: "added", files: [], count: 0 },
    { type: "deleted", files: [], count: 0 },
    { type: "modified", files: [], count: 0 },
    { type: "renamed", files: [], count: 0 },
  ];

  changes.forEach((change) => {
    let fileName = path.basename(change.uri.path);
    let filePath = path.basename(path.dirname(change.uri.path));
    if (filePath === root?.name) {
      filePath = ".";
    }
    let prefix: string = prefiexes[change.status];
    let commit = commits.find((commit: Commit) => commit.type === prefix);
    if (!commit) {
      return;
    }
    let file: File = { name: fileName, path: filePath };
    commit.files.push(file);
    commit.count++;
  });

  commits.sort((a: any, b: any) => (a > b ? 1 : -1));
  let groups: number = 0;
  commits.forEach((commit) => {
    if (commit.count > 0) {
      groups++;
    }
  });

  let messages: string[] = [];

  if (groups === 1) {
    let commit = commits.find((commit) => commit.count > 0);
    if (!commit) {
      return;
    }
    let samePath = commit.files.every(
      (file) => file.path === commit?.files[0].path
    );
    if (changes.length >= 3 && !samePath) {
      messages.push(`${commit.type} ${commit.count} files`);
    } else if (changes.length >= 3 && samePath) {
      messages.push(
        `${commit.type} ${commit.count} files ${preps.get(commit.type)} ${
          commit.files[0].path
        }`
      );
    } else if (changes.length === 2 && !samePath) {
      messages.push(
        `${commit.type} ${commit.files.map((file) => file.name).join(" and ")}`
      );
    } else if (changes.length <= 2 && samePath) {
      messages.push(
        `${commit.type} ${commit.files
          .map((file) => file.name)
          .join(" and ")} ${preps.get(commit.type)} ${commit.files[0].path}`
      );
    }
  } else if (changes.length <= 2) {
    commits.forEach((commit) => {
      if (commit.count === 0) {
        return;
      }
      if (commit.count <= 2) {
        messages.push(
          `${commit.type} ${commit.files.map((file) => file.name).join(", ")}`
        );
      }
    });
  } else {
    messages.push(`changed ${changes.length} files`);
  }

  repository.inputBox.value = messages.join(" ");
}

function listenRepositoryChanges(repository: Repository) {
  repository.state.onDidChange(() => {
    let enabled = vscode.workspace
      .getConfiguration()
      .get("git.autocommit.enabled");
    if (!enabled) {
      return;
    }
    writeAutoCommit(repository);
  });
}

function autoCommit() {
  git.repositories.forEach((repository) => {
    writeAutoCommit(repository);
  });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand("git.autocommit", autoCommit);

  let gitApiInterval = setInterval(() => {
    let connect = api();
    if (!connect) {
      return;
    }
    git = connect;
    git.repositories.forEach((repository) => {
      listenRepositoryChanges(repository);
    });

    git.onDidOpenRepository(listenRepositoryChanges);

    clearInterval(gitApiInterval);
  }, 100);
}

// this method is called when your extension is deactivated
export function deactivate() {}
