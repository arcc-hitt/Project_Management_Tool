import Project from '../models/Project.js';
import Issue from '../models/Issue.js';

const createError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

interface WorkflowState {
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  transitions: string[];
}

interface WorkflowDefinition {
  states: WorkflowState[];
}

const DEFAULT_WORKFLOW: WorkflowDefinition = {
  states: [
    { name: 'To Do', category: 'todo', transitions: ['In Progress'] },
    { name: 'In Progress', category: 'in_progress', transitions: ['In Review', 'To Do'] },
    { name: 'In Review', category: 'in_progress', transitions: ['In Progress', 'Done'] },
    { name: 'Done', category: 'done', transitions: [] },
  ],
};

class WorkflowService {
  /**
   * Get the workflow for a project. Returns the default workflow if none is set.
   */
  async getWorkflow(projectId: string): Promise<WorkflowDefinition> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    return project.workflow || DEFAULT_WORKFLOW;
  }

  /**
   * Update the workflow for a project.
   * Validates that all states have a category field.
   */
  async updateWorkflow(projectId: string, workflowDef: WorkflowDefinition): Promise<WorkflowDefinition> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    if (!workflowDef || !Array.isArray(workflowDef.states)) {
      throw createError('Workflow must have a states array', 400);
    }

    const validCategories = new Set(['todo', 'in_progress', 'done']);
    for (const state of workflowDef.states) {
      if (!state.name || typeof state.name !== 'string') {
        throw createError('Each workflow state must have a name', 400);
      }
      if (!state.category || !validCategories.has(state.category)) {
        throw createError(
          `State "${state.name}" must have a valid category: todo, in_progress, or done`,
          400
        );
      }
      if (!Array.isArray(state.transitions)) {
        throw createError(`State "${state.name}" must have a transitions array`, 400);
      }
    }

    await Project.update(projectId, { workflow: workflowDef });
    return workflowDef;
  }

  /**
   * Validate whether a transition from currentState to targetState is permitted.
   * Throws 422 if the transition is not allowed.
   */
  async validateTransition(
    projectId: string,
    currentState: string,
    targetState: string
  ): Promise<void> {
    const workflow = await this.getWorkflow(projectId);

    const stateObj = workflow.states.find((s) => s.name === currentState);
    if (!stateObj) {
      throw createError(`Current state "${currentState}" is not defined in the workflow`, 422);
    }

    if (!stateObj.transitions.includes(targetState)) {
      throw createError(
        `Transition from "${currentState}" to "${targetState}" is not permitted`,
        422
      );
    }
  }

  /**
   * Delete a workflow state. Throws 409 if any issues are currently in that state.
   */
  async deleteState(projectId: string, stateName: string): Promise<WorkflowDefinition> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const workflow: WorkflowDefinition = project.workflow || DEFAULT_WORKFLOW;

    const stateExists = workflow.states.some((s) => s.name === stateName);
    if (!stateExists) {
      throw createError(`State "${stateName}" not found in workflow`, 404);
    }

    // Check if any issues are currently in this state
    const issuesInState = await Issue.findAll({ projectId, status: stateName });
    if (issuesInState.length > 0) {
      throw createError(
        `Cannot delete state "${stateName}": ${issuesInState.length} issue(s) are currently in this state`,
        409
      );
    }

    const updatedWorkflow: WorkflowDefinition = {
      states: workflow.states
        .filter((s) => s.name !== stateName)
        .map((s) => ({
          ...s,
          transitions: s.transitions.filter((t) => t !== stateName),
        })),
    };

    await Project.update(projectId, { workflow: updatedWorkflow });
    return updatedWorkflow;
  }
}

export default new WorkflowService();
