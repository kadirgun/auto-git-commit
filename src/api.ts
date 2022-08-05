import * as vscode from 'vscode';
import { GitExtension } from './git';

const api = () => {
  return vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports.getAPI(1);
};

export default api;