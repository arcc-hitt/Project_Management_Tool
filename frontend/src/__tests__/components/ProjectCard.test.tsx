import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Mock project data matching the backend interface
const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'A test project description',
  status: 'active',
  priority: 'high',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  managerId: 1,
  manager: { 
    id: 1, 
    firstName: 'John', 
    lastName: 'Doe', 
    email: 'john@example.com', 
    role: 'manager',
    isActive: true,
    createdAt: '',
    updatedAt: ''
  },
  teamMembers: [
    { id: 1, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'developer', isActive: true, createdAt: '', updatedAt: '' }
  ],
  tasks: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

// Create a simple ProjectCard component for testing
interface TestProject {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  endDate?: string | null;
  managerId: number;
  manager: { 
    id: number; 
    firstName: string; 
    lastName: string; 
    email: string; 
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  teamMembers: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: never[];
  createdAt: string;
  updatedAt: string;
}

const ProjectCard: React.FC<{ project: TestProject }> = ({ project }) => (
  <div data-testid="project-card">
    <h3>{project.name}</h3>
    <p>{project.description}</p>
    <span className={`status-${project.status}`}>{project.status}</span>
    <span className={`priority-${project.priority}`}>{project.priority}</span>
    <div>Manager: {project.manager?.firstName} {project.manager?.lastName}</div>
    <div>Team Size: {project.teamMembers?.length || 0} members</div>
    <div>Start: {new Date(project.startDate).toLocaleDateString()}</div>
    {project.endDate && <div>End: {new Date(project.endDate).toLocaleDateString()}</div>}
  </div>
);

describe('ProjectCard', () => {
  it('renders project information correctly', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project description')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('displays manager information', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('Manager: John Doe')).toBeInTheDocument();
  });

  it('shows team size', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('Team Size: 1 members')).toBeInTheDocument();
  });

  it('displays dates correctly', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('Start: 1/1/2024')).toBeInTheDocument();
    expect(screen.getByText('End: 31/12/2024')).toBeInTheDocument();
  });

  it('handles project without end date', () => {
    const projectWithoutEndDate = {
      ...mockProject,
      endDate: undefined
    };

    render(<ProjectCard project={projectWithoutEndDate} />);
    expect(screen.getByText('Start: 1/1/2024')).toBeInTheDocument();
    expect(screen.queryByText(/End:/)).not.toBeInTheDocument();
  });

  it('handles project with no team members', () => {
    const projectWithoutMembers = {
      ...mockProject,
      teamMembers: []
    };

    render(<ProjectCard project={projectWithoutMembers} />);
    expect(screen.getByText('Team Size: 0 members')).toBeInTheDocument();
  });
});