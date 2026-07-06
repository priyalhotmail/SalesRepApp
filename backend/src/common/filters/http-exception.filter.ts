import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Response } from "express";

type ErrorResponse = {
  error: string;
  message: string | string[];
  path: string;
  statusCode: number;
  timestamp: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "message" in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : "Unexpected server error";

    const body: ErrorResponse = {
      error:
        exception instanceof HttpException
          ? exception.name
          : "InternalServerError",
      message,
      path: request.url,
      statusCode: status,
      timestamp: new Date().toISOString()
    };

    response.status(status).json(body);
  }
}

