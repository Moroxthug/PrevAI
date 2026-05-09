import VideoWithControls from "@/components/video/VideoWithControls";
import VideoTemplate from "@/components/video/VideoTemplate";

export default function App() {
  const isEmbed = new URLSearchParams(window.location.search).has("embed");
  if (isEmbed) return <VideoTemplate loop />;
  return <VideoWithControls />;
}
