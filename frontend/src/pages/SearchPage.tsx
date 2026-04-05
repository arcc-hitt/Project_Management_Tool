import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Filter, History, Star, Download, X, Clock, User, FolderOpen, CheckSquare, MessageCircle, SlidersHorizontal, BookmarkPlus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Pagination } from '../components/ui/pagination';
import { Checkbox } from '../components/ui/checkbox';
import { searchService } from '../services/searchService';
import type { SearchFilters, SearchResult } from '../services/searchService';
import { projectService } from '../services/projectService';
import type { Project } from '../types';
import { toast } from 'sonner';

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['project', 'task', 'user', 'comment']);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // UI States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSaveSearchDialog, setShowSaveSearchDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Facets for result categorization
  const [facets, setFacets] = useState({
    types: {} as { [key: string]: number },
    projects: {} as { [key: string]: number },
    status: {} as { [key: string]: number },
    priority: {} as { [key: string]: number }
  });

  const resultTypeConfig = {
    project: { icon: FolderOpen, color: 'text-green-500', label: 'Project' },
    task: { icon: CheckSquare, color: 'text-purple-500', label: 'Task' },
    user: { icon: User, color: 'text-blue-500', label: 'User' },
    comment: { icon: MessageCircle, color: 'text-orange-500', label: 'Comment' }
  };

  const statusOptions = ['todo', 'in_progress', 'in_review', 'done'];
  const priorityOptions = ['low', 'medium', 'high', 'urgent'];

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim().length >= 2) {
        performSearch(query);
        getSuggestions(query);
      } else {
        setSearchResults([]);
        setTotalResults(0);
        setSearchSuggestions([]);
      }
    }, 300),
    [selectedTypes, selectedProjects, selectedAssignees, selectedStatus, selectedPriority, dateRange, sortBy, sortOrder, currentPage]
  );

  // Debounce utility function
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [projectsResponse, historyResponse, savedResponse] = await Promise.all([
        projectService.getProjects({ limit: 100 }),
        searchService.getSearchHistory().catch(() => []),
        searchService.getSavedSearches().catch(() => [])
      ]);
      
      setProjects(projectsResponse.projects);
      setSearchHistory(historyResponse);
      setSavedSearches(savedResponse);
    } catch (error: any) {
      // Mock data for demo
      setProjects([
        { id: 1, name: 'Project Management Tool', description: 'Main project', status: 'active', createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' },
        { id: 2, name: 'E-commerce Platform', description: 'Online store', status: 'active', createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
      ] as Project[]);
      setSearchHistory(['user authentication', 'dashboard bugs', 'API endpoints', 'database migration']);
      setSavedSearches([
        { id: 1, name: 'My Open Tasks', query: 'assignee:me status:todo,in_progress', createdAt: '2025-01-01T10:00:00Z' },
        { id: 2, name: 'High Priority Items', query: 'priority:high,urgent', createdAt: '2025-01-01T10:00:00Z' }
      ]);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const startTime = Date.now();
      
      const filters: SearchFilters = {
        query,
        types: selectedTypes,
        projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
        assigneeIds: selectedAssignees.length > 0 ? selectedAssignees : undefined,
        status: selectedStatus.length > 0 ? selectedStatus : undefined,
        priority: selectedPriority.length > 0 ? selectedPriority : undefined,
        dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder
      };

      const response = await searchService.unifiedSearch(filters);
      
      setSearchResults(response.results);
      setTotalResults(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
      setFacets(response.facets || { types: {}, projects: {}, status: {}, priority: {} });
      setSearchTime(Date.now() - startTime);
      
    } catch (error: any) {
      toast.error(error.message || 'Search failed');
      
      // Mock search results for demo
      const mockResults: SearchResult[] = [
        {
          type: 'task',
          id: 1,
          title: 'Implement user authentication system',
          description: 'Create login and registration functionality with JWT tokens',
          relevanceScore: 0.95,
          highlight: 'user <mark>authentication</mark> system',
          data: { id: 1, title: 'Implement user authentication system', status: 'in_progress', priority: 'high' }
        },
        {
          type: 'project',
          id: 1,
          title: 'Project Management Tool',
          description: 'A comprehensive project management solution',
          relevanceScore: 0.87,
          highlight: 'Project <mark>Management</mark> Tool',
          data: { id: 1, name: 'Project Management Tool', status: 'active' }
        },
        {
          type: 'user',
          id: 1,
          title: 'John Doe',
          description: 'Senior Developer - john@example.com',
          relevanceScore: 0.75,
          highlight: '<mark>John</mark> Doe',
          data: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer' }
        }
      ];
      
      if (query.trim().length >= 2) {
        const filteredResults = mockResults.filter(result => 
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.description?.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filteredResults);
        setTotalResults(filteredResults.length);
        setTotalPages(1);
        setSearchTime(150);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getSuggestions = async (query: string) => {
    try {
      const suggestions = await searchService.getSearchSuggestions(query, 5);
      setSearchSuggestions(suggestions.map(s => s.text));
    } catch (error) {
      // Mock suggestions
      const mockSuggestions = [
        'user authentication',
        'dashboard components',
        'API integration',
        'database schema',
        'testing framework'
      ].filter(s => s.toLowerCase().includes(query.toLowerCase()));
      setSearchSuggestions(mockSuggestions.slice(0, 5));
    }
  };

  const handleSaveSearch = async () => {
    try {
      const filters: SearchFilters = {
        query: searchQuery,
        types: selectedTypes,
        projectIds: selectedProjects,
        assigneeIds: selectedAssignees,
        status: selectedStatus,
        priority: selectedPriority,
        dateRange,
        sortBy,
        sortOrder
      };

      await searchService.saveSearch(searchQuery, filters, saveSearchName);
      toast.success('Search saved successfully');
      setShowSaveSearchDialog(false);
      setSaveSearchName('');
      
      // Refresh saved searches
      const savedResponse = await searchService.getSavedSearches();
      setSavedSearches(savedResponse);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save search');
    }
  };

  const loadSavedSearch = (savedSearch: any) => {
    setSearchQuery(savedSearch.query);
    // Parse and apply filters from saved search
    toast.success(`Loaded saved search: ${savedSearch.name}`);
  };

  const clearAllFilters = () => {
    setSelectedTypes(['project', 'task', 'user', 'comment']);
    setSelectedProjects([]);
    setSelectedAssignees([]);
    setSelectedStatus([]);
    setSelectedPriority([]);
    setDateRange({ start: '', end: '' });
    setSortBy('relevance');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const getFilterCount = () => {
    let count = 0;
    if (selectedProjects.length > 0) count++;
    if (selectedAssignees.length > 0) count++;
    if (selectedStatus.length > 0) count++;
    if (selectedPriority.length > 0) count++;
    if (dateRange.start || dateRange.end) count++;
    if (selectedTypes.length !== 4) count++;
    return count;
  };

  const getResultIcon = (type: string) => {
    const config = resultTypeConfig[type as keyof typeof resultTypeConfig];
    if (config) {
      const IconComponent = config.icon;
      return <IconComponent className={`h-4 w-4 ${config.color}`} />;
    }
    return <SearchIcon className="h-4 w-4 text-gray-500" />;
  };

  const navigateToResult = (result: SearchResult) => {
    // Navigation logic based on result type
    const baseUrl = '';
    switch (result.type) {
      case 'project':
        window.open(`${baseUrl}/projects/${result.id}`, '_blank');
        break;
      case 'task':
        window.open(`${baseUrl}/tasks/${result.id}`, '_blank');
        break;
      case 'user':
        window.open(`${baseUrl}/users/${result.id}`, '_blank');
        break;
      default:
        break;
    }
  };

  // Filter results by active tab
  const getFilteredResults = () => {
    if (activeTab === 'all') return searchResults;
    return searchResults.filter(result => result.type === activeTab);
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Search</h1>
          <p className="text-muted-foreground">
            Search across projects, tasks, users, and comments with advanced filtering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowSaveSearchDialog(true)}
            disabled={!searchQuery.trim()}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save Search
          </Button>
          <Button variant="outline" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters {getFilterCount() > 0 && `(${getFilterCount()})`}
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all projects, tasks, users, and comments..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="pl-10 pr-4 text-lg h-12"
            />
            
            {/* Search Suggestions */}
            {showSuggestions && searchSuggestions.length > 0 && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Quick filters:</span>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('assignee:me')}>
                My Tasks
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('priority:high')}>
                High Priority
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('status:in_progress')}>
                In Progress
              </Button>
            </div>
            {getFilterCount() > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Content Types */}
              <div>
                <Label className="text-sm font-medium">Content Types</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(resultTypeConfig).map(([type, config]) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedTypes([...selectedTypes, type]);
                          } else {
                            setSelectedTypes(selectedTypes.filter(t => t !== type));
                          }
                        }}
                      />
                      <Label htmlFor={type} className="flex items-center gap-2 text-sm">
                        {getResultIcon(type)}
                        {config.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects */}
              <div>
                <Label htmlFor="projects">Projects</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="created">Date Created</SelectItem>
                    <SelectItem value="updated">Date Updated</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with History and Saved Searches */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Recent Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((query, index) => (
                  <button
                    key={index}
                    className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSearchQuery(query)}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Saved Searches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4" />
                Saved Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedSearches.slice(0, 5).map((saved) => (
                  <button
                    key={saved.id}
                    className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => loadSavedSearch(saved)}
                  >
                    {saved.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Results */}
        <div className="lg:col-span-3">
          {/* Results Header */}
          {searchQuery.trim() && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {isSearching ? 'Searching...' : `${totalResults} results found in ${searchTime}ms`}
                </span>
                {totalResults > 0 && (
                  <Button variant="outline" size="sm">
                    <Download className="h-3 w-3 mr-1" />
                    Export Results
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results Tabs */}
          {searchResults.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All ({searchResults.length})
                </TabsTrigger>
                {Object.entries(facets.types).map(([type, count]) => (
                  <TabsTrigger key={type} value={type}>
                    {resultTypeConfig[type as keyof typeof resultTypeConfig]?.label || type} ({count})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Results List */}
          <div className="space-y-4">
            {filteredResults.map((result) => (
              <Card key={`${result.type}-${result.id}`} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getResultIcon(result.type)}
                        <Badge variant="outline" className="text-xs">
                          {resultTypeConfig[result.type as keyof typeof resultTypeConfig]?.label || result.type}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Relevance:</span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.relevanceScore * 100)}%
                          </Badge>
                        </div>
                      </div>
                      <h3 
                        className="font-medium text-lg mb-1"
                        dangerouslySetInnerHTML={{ __html: result.highlight || result.title }}
                      />
                      {result.description && (
                        <p className="text-sm text-muted-foreground">
                          {result.description}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigateToResult(result)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No Results */}
          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or filters
                </p>
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalResults}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              itemName="results"
            />
          )}
        </div>
      </div>

      {/* Save Search Dialog */}
      <Dialog open={showSaveSearchDialog} onOpenChange={setShowSaveSearchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Save this search query and filters for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="searchName">Search Name</Label>
              <Input
                id="searchName"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder="Enter a name for this search..."
              />
            </div>
            <div>
              <Label>Search Query</Label>
              <Input value={searchQuery} disabled />
            </div>
            <div>
              <Label>Active Filters</Label>
              <div className="text-sm text-muted-foreground">
                {getFilterCount()} filters applied
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSearchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>
              Save Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchPage;