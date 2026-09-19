namespace Chronicle.Worker;

public sealed class BootstrapWorker(
    ILogger<BootstrapWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Chronicle Worker bootstrap is running. Ingestion is intentionally disabled until the first ingestion vertical slice.");

        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Chronicle Worker bootstrap is stopping.");
        }
    }
}
