export interface CommunitySpotlightProject {
  slug: string;
  name: string;
  tag: string;
  voteCount: number;
  commentCount: number;
  score: number;
  createdAt: string;
}

export interface CommunityTopicHighlight {
  slug: string;
  name: string;
  projectCount: number;
}

export interface CommunityHighlightsResponse {
  projects: CommunitySpotlightProject[];
  topics: CommunityTopicHighlight[];
}
