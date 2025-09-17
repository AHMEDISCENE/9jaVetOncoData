import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FeedPost } from "@shared/schema";

interface CreatePostData {
  title: string;
  body: string;
  tags: string[];
}

export default function Feeds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState<CreatePostData>({
    title: "",
    body: "",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const { data: posts, isLoading, error } = useQuery<FeedPost[]>({
    queryKey: ["/api/feeds"],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: CreatePostData) => {
      const response = await apiRequest("POST", "/api/feeds", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      setNewPost({ title: "", body: "", tags: [] });
      setIsCreating(false);
      toast({
        title: "Post created successfully",
        description: "Your post has been published to the feed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create post",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePost = () => {
    if (!newPost.title.trim() || !newPost.body.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a title and content for your post.",
        variant: "destructive",
      });
      return;
    }

    createPostMutation.mutate(newPost);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !newPost.tags.includes(tag)) {
      setNewPost(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewPost(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const canCreatePost = user?.role === "ADMIN" || user?.role === "MANAGER";

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <i className="fas fa-exclamation-triangle text-destructive text-4xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Unable to load feeds</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please check your connection and try again."}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry-feeds">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Feeds & Updates</h2>
          <p className="text-muted-foreground">Latest news, research, and announcements</p>
        </div>
        {canCreatePost && (
          <Button 
            onClick={() => setIsCreating(true)} 
            className="mt-4 sm:mt-0"
            data-testid="button-create-post"
          >
            <i className="fas fa-plus mr-2"></i>Create Post
          </Button>
        )}
      </div>

      {/* Create Post Form */}
      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="Post title..."
                value={newPost.title}
                onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-post-title"
              />
            </div>
            
            <div>
              <Textarea
                placeholder="Write your post content here... (Markdown supported)"
                value={newPost.body}
                onChange={(e) => setNewPost(prev => ({ ...prev, body: e.target.value }))}
                className="min-h-32"
                data-testid="textarea-post-content"
              />
            </div>

            <div>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  data-testid="input-post-tags"
                />
                <Button variant="outline" onClick={addTag} data-testid="button-add-tag">
                  Add
                </Button>
              </div>
              
              {newPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newPost.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button 
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-tag-${tag}`}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleCreatePost}
                disabled={createPostMutation.isPending}
                data-testid="button-publish-post"
              >
                {createPostMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Publishing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2"></i>
                    Publish
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsCreating(false)}
                data-testid="button-cancel-post"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed Posts */}
      <div className="space-y-6">
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{post.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <i className="fas fa-user mr-1"></i>
                        Author
                      </span>
                      <span>
                        <i className="fas fa-calendar mr-1"></i>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                      {post.clinicId && (
                        <Badge variant="outline">Clinic Post</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none mb-4">
                  {post.body.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-2 last:mb-0">{paragraph}</p>
                  ))}
                </div>
                
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <i className="fas fa-rss text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to share news, research updates, or announcements with the community.
              </p>
              {canCreatePost && (
                <Button onClick={() => setIsCreating(true)} data-testid="button-create-first-post">
                  <i className="fas fa-plus mr-2"></i>Create First Post
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
