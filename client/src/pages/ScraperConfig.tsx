import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, CheckCircle, Circle } from "lucide-react";

// Scraper configuration admin panel
export function ScraperConfig() {
  const [newSubreddit, setNewSubreddit] = useState("");
  const [newSubredditCity, setNewSubredditCity] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState<"seeking" | "entertainment">("seeking");

  // Queries
  const subredditsQuery = trpc.scraperConfig.listSubreddits.useQuery();
  const keywordsQuery = trpc.scraperConfig.listKeywords.useQuery();

  // Mutations
  const addSubredditMutation = trpc.scraperConfig.addSubreddit.useMutation({
    onSuccess: () => {
      subredditsQuery.refetch();
      setNewSubreddit("");
      setNewSubredditCity("");
    },
  });

  const updateSubredditMutation = trpc.scraperConfig.updateSubreddit.useMutation({
    onSuccess: () => subredditsQuery.refetch(),
  });

  const deleteSubredditMutation = trpc.scraperConfig.deleteSubreddit.useMutation({
    onSuccess: () => subredditsQuery.refetch(),
  });

  const addKeywordMutation = trpc.scraperConfig.addKeyword.useMutation({
    onSuccess: () => {
      keywordsQuery.refetch();
      setNewKeyword("");
      setNewKeywordType("seeking");
    },
  });

  const updateKeywordMutation = trpc.scraperConfig.updateKeyword.useMutation({
    onSuccess: () => keywordsQuery.refetch(),
  });

  const deleteKeywordMutation = trpc.scraperConfig.deleteKeyword.useMutation({
    onSuccess: () => keywordsQuery.refetch(),
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scraper Configuration</h1>
        <p className="text-gray-600 mt-2">Manage subreddits and keywords for lead scraping</p>
      </div>

      <Tabs defaultValue="subreddits" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subreddits">Subreddits</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        {/* ─── Subreddits Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="subreddits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Subreddit</CardTitle>
              <CardDescription>Add a new subreddit to scrape for leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., weddingplanning"
                  value={newSubreddit}
                  onChange={(e) => setNewSubreddit(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="City hint (optional)"
                  value={newSubredditCity}
                  onChange={(e) => setNewSubredditCity(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() =>
                    addSubredditMutation.mutate({
                      subreddit: newSubreddit,
                      cityHint: newSubredditCity || undefined,
                    })
                  }
                  disabled={!newSubreddit || addSubredditMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Subreddits</CardTitle>
              <CardDescription>{subredditsQuery.data?.length || 0} subreddits configured</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subredditsQuery.data?.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">r/{sub.subreddit}</div>
                      {sub.cityHint && <div className="text-sm text-gray-600">{sub.cityHint}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateSubredditMutation.mutate({
                            id: sub.id,
                            isActive: !sub.isActive,
                          })
                        }
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        {sub.isActive ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteSubredditMutation.mutate({ id: sub.id })}
                        className="p-2 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Keywords Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="keywords" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Keyword</CardTitle>
              <CardDescription>Add a keyword to filter for buyer intent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., need dj"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="flex-1"
                />
                <Select value={newKeywordType} onValueChange={(val: any) => setNewKeywordType(val)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeking">Seeking</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() =>
                    addKeywordMutation.mutate({
                      keyword: newKeyword,
                      type: newKeywordType,
                    })
                  }
                  disabled={!newKeyword || addKeywordMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Keywords</CardTitle>
              <CardDescription>{keywordsQuery.data?.length || 0} keywords configured</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {keywordsQuery.data?.map((kw) => (
                  <div key={kw.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">{kw.keyword}</div>
                      <div className="text-sm text-gray-600">
                        Type: <span className="font-medium">{kw.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateKeywordMutation.mutate({
                            id: kw.id,
                            isActive: !kw.isActive,
                          })
                        }
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        {kw.isActive ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteKeywordMutation.mutate({ id: kw.id })}
                        className="p-2 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
