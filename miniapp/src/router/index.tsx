import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import HomePage from "@/pages/Home/HomePage";
import MyTasksPage from "@/pages/MyTasks/MyTasksPage";
import ProjectsPage from "@/pages/Projects/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetail/ProjectDetailPage";
import EpisodeDetailPage from "@/pages/EpisodeDetail/EpisodeDetailPage";
import CharacterDetailPage from "@/pages/CharacterDetail/CharacterDetailPage";
import TaskDetailPage from "@/pages/TaskDetail/TaskDetailPage";
import ProfilePage from "@/pages/Profile/ProfilePage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/tasks", element: <MyTasksPage /> },
      { path: "/tasks/:taskId", element: <TaskDetailPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectDetailPage /> },
      { path: "/episodes/:episodeId", element: <EpisodeDetailPage /> },
      { path: "/characters/:characterId", element: <CharacterDetailPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
]);
