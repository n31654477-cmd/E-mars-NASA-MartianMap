using Backend.Models;

namespace Backend.Business
{
    public class ShortestPathAlgorithms
    {
        public static PathResult FindShortestPathBFS(
         Cell[][] grid,
         Point start,
         Point destination)
        {
            AlgorithmsValidator.ValidateRequest(grid, start, destination);

            int rows = grid.Length;
            int cols = grid[0].Length;

            bool[,] visited = new bool[rows, cols];
            Point[,] parents = new Point[rows, cols];
            Queue<Point> frontier = new Queue<Point>();

            visited[start.Row, start.Col] = true;
            frontier.Enqueue(start);

            while (frontier.Count > 0)
            {
                Point current = frontier.Dequeue();

                if (AlgorithmsCommon.AreSamePoint(current, destination))
                    break;

                foreach (Point neighbor in AlgorithmsCommon.GetNeighbors(current, rows, cols))
                {
                    int row = neighbor.Row;
                    int col = neighbor.Col;

                    if (visited[row, col] || grid[row][col].Blocked)
                        continue;

                    visited[row, col] = true;
                    parents[row, col] = current;
                    frontier.Enqueue(neighbor);
                }
            }

            List<Point> path = AlgorithmsCommon.ReconstructPath(parents, start, destination);

            return AlgorithmsCommon.BuildResult(grid, path);
        }
    }
}
